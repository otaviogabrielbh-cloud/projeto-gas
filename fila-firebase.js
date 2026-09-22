// =========================================================================
// Módulo de Fila na Nuvem (Firebase Realtime Database)
// Permite que qualquer computador, celular ou tablet envie mensagens
// através deste servidor de WhatsApp rodando no Notebook.
// =========================================================================

const os = require('os');

const FIREBASE_BASE_URL = 'https://canoas-gas-default-rtdb.firebaseio.com';

module.exports = function iniciarFilaFirebase(deps) {
    const { executeSend, getClientStatus, isRecovering } = deps;

    console.log('☁️ [Fila Firebase] Inicializando escuta de mensagens na nuvem...');

    let isProcessing = false;

    // 1. Heartbeat - Informa à nuvem a cada 15 segundos se o notebook está online
    async function enviarHeartbeat() {
        try {
            const statusAtual = (typeof getClientStatus === 'function') ? getClientStatus() : 'connected';
            const payload = {
                online: true,
                status: statusAtual,
                timestamp: Date.now(),
                hostname: os.hostname(),
                recovering: (typeof isRecovering === 'function') ? isRecovering() : false
            };

            await fetch(`${FIREBASE_BASE_URL}/servidor_whatsapp_status.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (err) {
            // Silencioso para não poluir terminal se a internet oscilar
        }
    }

    // 2. Processador da Fila de Mensagens
    async function processarFila() {
        if (isProcessing) return;

        const statusAtual = (typeof getClientStatus === 'function') ? getClientStatus() : 'connected';
        const emRecuperacao = (typeof isRecovering === 'function') ? isRecovering() : false;

        // Se o WhatsApp não estiver pronto, aguarda
        if (statusAtual !== 'connected' || emRecuperacao) {
            return;
        }

        isProcessing = true;
        try {
            const res = await fetch(`${FIREBASE_BASE_URL}/fila_whatsapp.json`);
            if (!res.ok) {
                isProcessing = false;
                return;
            }

            const fila = await res.json();
            if (!fila) {
                isProcessing = false;
                return;
            }

            for (const [id, item] of Object.entries(fila)) {
                if (!item || item.status !== 'pendente') continue;

                const telLimpo = String(item.telefone || item.number || item.phone || '').replace(/\D/g, '');
                const texto = item.mensagem || item.text || item.message || '';
                const imagem = item.imagem || item.image || item.media || null;
                const filename = item.filename || 'anexo.jpg';

                if (!telLimpo || (!texto && !imagem)) {
                    await fetch(`${FIREBASE_BASE_URL}/fila_whatsapp/${id}.json`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'invalido', erro: 'Telefone ou mensagem ausente' })
                    });
                    continue;
                }

                console.log(`📥 [Fila Firebase] Processando mensagem para ${item.destinatario || telLimpo} (${item.tipo || 'geral'})...`);

                // Marca como processando para evitar reenvio paralelo
                await fetch(`${FIREBASE_BASE_URL}/fila_whatsapp/${id}.json`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'processando', inicioProcessamento: Date.now() })
                });

                try {
                    await executeSend(telLimpo, texto, imagem, filename);
                    console.log(`✅ [Fila Firebase] Mensagem entregue com sucesso para: ${telLimpo}`);

                    await fetch(`${FIREBASE_BASE_URL}/fila_whatsapp/${id}.json`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            status: 'enviado',
                            enviadoEm: Date.now(),
                            erro: null
                        })
                    });
                } catch (envioErr) {
                    console.error(`❌ [Fila Firebase] Falha ao enviar para ${telLimpo}:`, envioErr.message);

                    const tentativas = (item.tentativas || 0) + 1;
                    const novoStatus = tentativas >= 3 ? 'erro_definitivo' : 'pendente';

                    await fetch(`${FIREBASE_BASE_URL}/fila_whatsapp/${id}.json`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            status: novoStatus,
                            tentativas: tentativas,
                            ultimoErro: envioErr.message,
                            falhaEm: Date.now()
                        })
                    });
                }

                // Pequena pausa entre envios para humanizar e evitar bloqueio
                await new Promise(r => setTimeout(r, 1500));
            }
        } catch (loopErr) {
            console.error('⚠️ [Fila Firebase] Erro ao consultar fila:', loopErr.message);
        } finally {
            isProcessing = false;
        }
    }

    // Iniciar loops periódicos
    setInterval(enviarHeartbeat, 15000);
    enviarHeartbeat();

    setInterval(processarFila, 4000);
    setTimeout(processarFila, 2000);

    console.log('✅ [Fila Firebase] Conectado e monitorando pedidos em tempo real!');
};
