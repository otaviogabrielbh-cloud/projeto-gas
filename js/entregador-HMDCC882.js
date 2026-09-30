
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, update, get, onDisconnect, push, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyB-4XspbY5GalueBG8JGUJ7BfdQvPh8d1c",
    authDomain: "canoas-gas.firebaseapp.com",
    databaseURL: "https://canoas-gas-default-rtdb.firebaseio.com",
    projectId: "canoas-gas",
    storageBucket: "canoas-gas.firebasestorage.app",
    messagingSenderId: "657432003828",
    appId: "1:657432003828:web:40c6eca9096896f955caa1"
};

const app = initializeApp(firebaseConfig);
const remoteDb = getDatabase(app);
window.remoteDb = remoteDb;
window.firebaseUpdate = update;
window.firebaseRef = ref;

// --- Deliverer-Specific UI & Session Logic ---
window.logout = function () {
    if (confirm("Deseja sair do sistema?")) {
        try {
            if (window.AndroidNativeLocation && typeof window.AndroidNativeLocation.stopBackgroundTracking === 'function') {
                window.AndroidNativeLocation.stopBackgroundTracking();
            }
        } catch (e) {}
        localStorage.clear();
        location.href = 'index.html';
    }
}

window.verificarSessao = function () {
    const role = localStorage.getItem('userRole');
    const userName = localStorage.getItem('userName');
    if (role !== 'entregador') {
        location.href = 'index.html';
        return;
    }
    const titleEl = document.getElementById('delivererTitle');
    if (titleEl) {
        titleEl.innerHTML = `📦 Meus Pedidos (${userName}) <span id="totalPedidos" class="contador-pedidos">0</span> <small id="refreshTimer" style="font-size: 11px; color: #888; margin-left:10px; font-weight:normal;">🔄 30s</small>`;
    }
    window.solicitarWakeLock();
    window.iniciarKeepAlive();
    window.iniciarRastreamento();
    if (window.iniciarEscutaTempoReal) window.iniciarEscutaTempoReal();
}

function atualizarPainelDiag(chave, status, cor) {
    const elOld = document.getElementById('diag' + chave);
    if (elOld) {
        elOld.innerText = status;
        elOld.style.color = cor;
    }

    // Atualização da Status Bar (Novo Design)
    const elNew = document.getElementById('status' + chave);
    if (elNew) {
        elNew.className = 'status-indicator ' + (status.includes('ON') || status.includes('ATIVO') ? 'status-ok' : 'status-bad');
        // Opcional: tooltip ou texto
    }
}

// GPS Tracking & Proximidade
let watchId = null;
let gpsHeartbeatId = null;
window.posicaoEntregadorAtual = null;

try {
    const cachedPos = localStorage.getItem('entregador_ultima_pos');
    if (cachedPos) window.posicaoEntregadorAtual = JSON.parse(cachedPos);
} catch (e) {}

window.ultimaPosicaoGravadaHistorico = window.ultimaPosicaoGravadaHistorico || null;

function processarNovaPosicaoGPS(pos) {
    if (!pos || !pos.coords) return;
    const { latitude, longitude, accuracy, speed, heading } = pos.coords;
    window.posicaoEntregadorAtual = {
        lat: latitude,
        lng: longitude,
        accuracy: accuracy || 0,
        speed: speed || 0,
        heading: heading || 0,
        timestamp: Date.now()
    };
    try {
        localStorage.setItem('entregador_ultima_pos', JSON.stringify({ lat: latitude, lng: longitude }));
    } catch (e) {}

    atualizarPainelDiag('GPS', '🟢 ON', '#55efc4');

    const nome = localStorage.getItem('userName');
    if (nome && window.firebaseUpdate && window.remoteDb && window.firebaseRef) {
        const updateData = {
            lat: latitude,
            lng: longitude,
            accuracy: accuracy || 0,
            speed: speed || 0,
            heading: heading || 0,
            online: true,
            ultimaVez: Date.now(),
            nome: nome
        };
        window.firebaseUpdate(window.firebaseRef(window.remoteDb, `status_entregadores/${nome}`), updateData);

        // Registrar histórico de rota efetiva (linha vermelha no mapa)
        const agora = Date.now();
        const dataHoje = new Date().toISOString().split('T')[0];
        let registrarPonto = false;

        if (!window.ultimaPosicaoGravadaHistorico) {
            registrarPonto = true;
        } else {
            const distM = typeof window.calcularDistanciaMetros === 'function'
                ? window.calcularDistanciaMetros(window.ultimaPosicaoGravadaHistorico.lat, window.ultimaPosicaoGravadaHistorico.lng, latitude, longitude)
                : 100;
            const tempoMs = agora - window.ultimaPosicaoGravadaHistorico.timestamp;
            if (distM >= 15 || (tempoMs >= 30000 && distM >= 3)) {
                registrarPonto = true;
            }
        }

        if (registrarPonto && window.firebasePush) {
            window.ultimaPosicaoGravadaHistorico = { lat: latitude, lng: longitude, timestamp: agora };
            const pontoHist = {
                lat: latitude,
                lng: longitude,
                timestamp: agora,
                speed: speed || 0
            };
            window.firebasePush(window.firebaseRef(window.remoteDb, `historico_gps/${nome}/${dataHoje}`), pontoHist);
        }
    }

    if (typeof window.atualizarDistanciasUI === 'function') {
        window.atualizarDistanciasUI();
    }
}

window.iniciarRastreamento = async function () {
    const nome = localStorage.getItem('userName');
    if (!nome) return;
    if (!('geolocation' in navigator)) {
        atualizarPainelDiag('GPS', '❌ INDISPONÍVEL', '#ff7675');
        return;
    }

    // Solicitar permissão de GPS explicitamente (necessário para Android)
    try {
        const permStatus = await navigator.permissions.query({ name: 'geolocation' });
        if (permStatus.state === 'denied') {
            atualizarPainelDiag('GPS', '🔴 BLOQUEADO', '#ff7675');
            alert('📍 O GPS está bloqueado!\n\nPor favor, ative a permissão de Localização nas configurações do app para o rastreamento funcionar.');
            return;
        }
        permStatus.onchange = () => {
            if (permStatus.state === 'granted') {
                console.log('✅ Permissão de GPS concedida!');
                window.iniciarRastreamento();
            }
        };
    } catch (e) {
        console.warn('Permissions API indisponível, tentando GPS direto:', e);
    }

    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = navigator.geolocation.watchPosition(
        (pos) => processarNovaPosicaoGPS(pos),
        (err) => {
            console.warn("GPS watchPosition aviso:", err);
            if (err.code === 1) {
                atualizarPainelDiag('GPS', '🔴 NEGADO', '#ff7675');
                alert('📍 Permissão de localização negada. Ative nas configurações do app.');
            } else {
                atualizarPainelDiag('GPS', '🟠 TENTANDO', '#fab1a0');
            }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    if (gpsHeartbeatId) clearInterval(gpsHeartbeatId);
    gpsHeartbeatId = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
            (pos) => processarNovaPosicaoGPS(pos),
            (err) => console.warn("GPS heartbeat aviso:", err),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
        );
    }, 20000);

    // Ativar Serviço Nativo Android em Segundo Plano (Foreground Service com tela desligada)
    try {
        if (window.AndroidNativeLocation && typeof window.AndroidNativeLocation.startBackgroundTracking === 'function') {
            window.AndroidNativeLocation.startBackgroundTracking(nome);
            console.log("🚀 Foreground Service nativo Android ativado para:", nome);
            atualizarPainelDiag('Wake', '🟢 2º PLANO', '#55efc4');
        }
    } catch (e) {
        console.warn("Aviso ao iniciar serviço nativo Android:", e);
    }
};

// Cálculo de Distância Geodésica (Haversine)
window.calcularDistanciaMetros = function (lat1, lon1, lat2, lon2) {
    if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return null;
    if (lat1 === 0 && lon1 === 0) return null;
    if (lat2 === 0 && lon2 === 0) return null;

    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

window.formatarDistancia = function (metros) {
    if (metros === null || metros === undefined || isNaN(metros)) return '';
    if (metros < 1000) {
        return `${Math.round(metros)} m`;
    }
    return `${(metros / 1000).toFixed(1)} km`;
};

const CACHE_GEO_PREFIX = 'geo_cache_v2_';
window.coordenadasMemoriaCache = {};

window.obterCoordenadasEndereco = async function (endereco) {
    if (!endereco || typeof endereco !== 'string') return null;

    // Separa bairro colado ao nome da cidade (ex: "Coração EucarísticoBelo Horizonte" → "Coração Eucarístico, Belo Horizonte")
    const enderecoCorrigido = endereco
        .replace(/([a-záàãâéêíóôõúüçA-ZÁÀÃÂÉÊÍÓÔÕÚÜÇ])([A-ZÁÀÃÂÉÊÍÓÔÕÚÜÇ][a-záàãâéêíóôõúüç])/g, '$1, $2')
        .replace(/\s*-\s*$/, '')
        .trim();

    const cleanAddr = enderecoCorrigido
        .replace(/\b(apto|apartamento|bloco|casa|fundos|sala|loja|quadra|lote|portaria)\b.*$/i, '')
        .replace(/[^\w\s,]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

    if (!cleanAddr) return null;

    if (window.coordenadasMemoriaCache[cleanAddr]) {
        return window.coordenadasMemoriaCache[cleanAddr];
    }

    const cacheKey = CACHE_GEO_PREFIX + cleanAddr.replace(/[^A-Z0-9]/g, '_');
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            window.coordenadasMemoriaCache[cleanAddr] = parsed;
            return parsed;
        }
    } catch (e) {}

    // Tentativas em ordem: endereço completo, sem número, só rua+bairro
    const tentativas = [
        cleanAddr + ', Belo Horizonte, MG, Brasil',
        cleanAddr + ', Belo Horizonte, Brasil',
        cleanAddr.replace(/,.*$/, '') + ', Belo Horizonte, MG, Brasil',
    ];

    for (const q of tentativas) {
        try {
            const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1`);
            const data = await res.json();
            if (data && data.features && data.features.length > 0) {
                const coords = { 
                    lat: parseFloat(data.features[0].geometry.coordinates[1]), 
                    lng: parseFloat(data.features[0].geometry.coordinates[0]) 
                };
                window.coordenadasMemoriaCache[cleanAddr] = coords;
                try { localStorage.setItem(cacheKey, JSON.stringify(coords)); } catch (e) {}
                return coords;
            }
        } catch (e) {
            console.warn("Erro ao geocodificar com Photon:", q, e);
        }
        await new Promise(r => setTimeout(r, 200));
    }
    return null;
};

// Wake Lock
let wakeLock = null;
window.solicitarWakeLock = async function () {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            atualizarPainelDiag('Wake', '🟢 ATIVO', '#55efc4');
            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock liberado. Tentando recuperar...');
                if (document.visibilityState === 'visible') window.solicitarWakeLock();
            });
        }
    } catch (err) {
        atualizarPainelDiag('Wake', '❌ ERRO', '#fab1a0');
    }
}

// Keep Alive Vídeo
function iniciarVideoStayAlive() {
    let video = document.getElementById('stayAliveVideo');
    if (!video) {
        video = document.createElement('video');
        video.id = 'stayAliveVideo';
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.style.cssText = "position:fixed; top:0; left:0; width:1px; height:1px; opacity:0.01; pointer-events:none;";
        video.src = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pY29uYXZjMQAAAAhfreePAAAAAG1vb3YAAABsbXZoZAAAAADNo+mRzaPpkQAAAbQAAAG0AAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAc dHJhawAAAFx0a2hkAAAAAc2j6ZHNv+mRAAABtAAAAAAAAAABAAAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAQAAAAGlbZHBzAAAACHBhc3AAAAABAAAACHBhc3AAAAABAAAAFmVkdHMAAAAMZWxzdAAAAAABAAABAAAfbWRpYQAAACBtZGhkAAAAAM2j6ZHNv+mRAAAH0AAABy5VSHf/AAAAAhtZGhkAAAAAM2j6ZHNv+mRAAAH0AAABy5VSHf/AAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXI= ";
        document.body.appendChild(video);
    }
    video.play().catch(e => console.warn("Erro ao iniciar vídeo stay-alive:", e));
}

// Heartbeat de Rede
function iniciarHeartbeat() {
    setInterval(() => {
        const nome = localStorage.getItem('userName');
        if (nome && window.remoteDb) {
            const heartbeatRef = window.firebaseRef(window.remoteDb, `status_entregadores/${nome}/heartbeat`);
            window.firebaseUpdate(window.firebaseRef(window.remoteDb, `status_entregadores/${nome}`), {
                heartbeat: Date.now()
            });
        }
    }, 30000);
}

window.ativarAlertasPrioritarios = async function () {
    console.log("🚀 Ativando modo de alta prioridade...");
    if (window.permitirNotificacoes) await window.permitirNotificacoes();
    if (window.solicitarWakeLock) await window.solicitarWakeLock();
    window.iniciarKeepAlive();
    iniciarVideoStayAlive();
    iniciarHeartbeat();
    window.mostrarMensagemSucesso("✅ Monitoramento ATIVO!");
};

window.testarAlerta = function () {
    window.mostrarMensagemSucesso("📢 Testando alerta em 3 segundos...");
    setTimeout(() => {
        tocarAlertaSonoro();
    }, 3000);
};

function configurarMediaSession() {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: 'Canoas Gás - OPERAÇÃO ATIVA',
            artist: 'Entregador em Rota',
            album: 'Mantenha em Segundo Plano',
            artwork: [
                { src: 'logo.png', sizes: '512x512', type: 'image/png' }
            ]
        });
        navigator.mediaSession.setActionHandler('play', () => {
            console.log("MediaSession: Play");
            window.iniciarKeepAlive();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
            console.log("MediaSession: Pause (bloqueado)");
            setTimeout(() => window.iniciarKeepAlive(), 100);
        });
        navigator.mediaSession.playbackState = "playing";
    }
}

let keepAliveRetries = 0;
window.iniciarKeepAlive = function () {
    if (window.isPlayingAlert) return;
    if (window.silentAudioInstance && !window.silentAudioInstance.paused) {
        atualizarPainelDiag('Audio', '🟢 ON', '#55efc4');
        return;
    }
    console.log("🔊 Iniciando Loop de Keep-Alive...");
    if (!window.silentAudioInstance) {
        window.silentAudioInstance = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==");
        window.silentAudioInstance.loop = true;
        window.silentAudioInstance.volume = 0.02;
        window.silentAudioInstance.onpause = () => {
            if (!window.isPlayingAlert) {
                console.warn("⚠️ Keep-alive pausado pelo sistema. Reiniciando...");
                setTimeout(() => window.iniciarKeepAlive(), 500);
            }
        };
    }
    window.silentAudioInstance.play().then(() => {
        configurarMediaSession();
        atualizarPainelDiag('Audio', '🟢 ON', '#55efc4');
        keepAliveRetries = 0;
    }).catch((err) => {
        console.error("❌ Erro no Keep-Alive:", err);
        atualizarPainelDiag('Audio', '🟠 TOCAR', '#e17055');
        if (keepAliveRetries < 5) {
            keepAliveRetries++;
            setTimeout(() => window.iniciarKeepAlive(), 2000);
        }
    });
}

// Alerta Buzina
let buzinaAudioInstance = null;
async function tocarAlertaSonoro() {
    if (window.isPlayingAlert) return;
    window.isPlayingAlert = true;
    console.log("🔔 Alerta Sonoro: Iniciando...");
    if ('vibrate' in navigator) {
        navigator.vibrate([1000, 500, 1000, 500, 2000]);
    }
    if (window.silentAudioInstance) {
        window.silentAudioInstance.pause();
    }
    if (!buzinaAudioInstance) {
        buzinaAudioInstance = new Audio("./buzina.mp3");
        buzinaAudioInstance.onended = () => {
            window.isPlayingAlert = false;
            window.iniciarKeepAlive();
        };
    }
    buzinaAudioInstance.currentTime = 0;
    buzinaAudioInstance.play().then(() => {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = "playing";
        }
        if (window.mostrarMensagemSucesso) window.mostrarMensagemSucesso("🔊 NOVO PEDIDO!");
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'NOTIFICAR_PEDIDO',
                body: '💰 Novo pedido disponível! Toque para ver.',
                url: './entregador.html'
            });
        }
    }).catch((err) => {
        console.error("Erro ao tocar alarme:", err);
        window.isPlayingAlert = false;
        window.iniciarKeepAlive();
    });
}
window.tocarAlertaSonoro = tocarAlertaSonoro;

window.mostrarMensagemSucesso = function (txt) {
    const msg = document.getElementById('msgCopiado');
    if (msg) {
        msg.innerText = txt || "Sucesso! ✅";
        msg.style.display = 'block';
        setTimeout(() => { msg.style.display = 'none'; }, 3000);
    }
}

window.permitirNotificacoes = async function () {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    if (permission === 'granted') window.mostrarMensagemSucesso("Notificações ativadas! 🔔");
}

window.iniciarEscutaTempoReal = function () {
    const pedidosRef = query(ref(remoteDb, 'pedidos_realtime'), limitToLast(500));
    onValue(pedidosRef, (snapshot) => {
        const data = snapshot.val();
        let todosPedidos = [];
        if (data) {
            Object.keys(data).forEach(key => {
                todosPedidos.push({ id: key, ...data[key] });
            });
        }
        window.pedidosCache = todosPedidos;
        window.renderizarTabelaPorData();
    });
    const nome = localStorage.getItem('userName');
    if (nome) {
        const statusRef = ref(remoteDb, 'status_entregadores/' + nome);
        onDisconnect(statusRef).update({
            online: false,
            ultimaVez: Date.now()
        });
    }
}

let renderTimeout = null;
window.atualizarDistanciasUI = function () {
    if (renderTimeout) clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => {
        if (typeof window.renderizarTabelaPorData === 'function') {
            window.renderizarTabelaPorData();
        }
    }, 300);
};

let geocodificando = false;
async function processarFilaGeocodificacao(pedidos) {
    if (geocodificando) return;
    geocodificando = true;
    let novaCoordenadaObtida = false;

    for (const p of pedidos) {
        if (!p.endereco) continue;
        const cleanAddr = p.endereco
            .replace(/\b(apto|apartamento|bloco|casa|fundos|sala|loja|quadra|lote|portaria)\b.*$/i, '')
            .replace(/[^\w\s]/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();

        if (cleanAddr && !window.coordenadasMemoriaCache[cleanAddr]) {
            const coords = await window.obterCoordenadasEndereco(p.endereco);
            if (coords) {
                novaCoordenadaObtida = true;
            }
            await new Promise(r => setTimeout(r, 350));
        }
    }

    geocodificando = false;
    if (novaCoordenadaObtida) {
        window.atualizarDistanciasUI();
    }
}

function renderizarBannerSugestao(maisProximo) {
    const container = document.getElementById('containerSugestaoProxima');
    if (container) container.innerHTML = '';
}

window.iniciarRotaDireta = function(id, encodedEndereco) {
    const endereco = decodeURIComponent(encodedEndereco);
    window.statusPedido(id, 'Em Rota');
    window.open(`https://waze.com/ul?q=${encodeURIComponent(endereco)}`, '_blank');
};

window.abrirPedidoPorId = function(id) {
    const p = (window.pedidosCache || []).find(item => item.id === id);
    if (p) window.mostrarDetalhesPedido(p);
};

window.renderizarTabelaPorData = function () {
    const container = document.getElementById('containerCardsMobile');
    const filtroEl = document.getElementById('filtroStatusEntregador');
    const statusFiltro = filtroEl ? filtroEl.value : 'pendente';
    const ordemFiltro = document.getElementById('filtroOrdemEntregador')?.value || 'prioridade';
    const userName = localStorage.getItem('userName');

    if (!container || !userName) return;

    const now = new Date();
    const todayStr = now.toLocaleDateString('pt-BR');

    const pedidos = (window.pedidosCache || []).filter(p => {
        const dataPedidoStr = (p.data || '').split(',')[0].trim();
        const bateData = dataPedidoStr === todayStr;
        if (!bateData) return false;

        const entregadorMatch = (p.entregador || '').trim().toUpperCase() === userName.trim().toUpperCase();
        if (!entregadorMatch) return false;

        const statusNormalizado = (p.statusEntrega || 'Pendente').trim().toUpperCase();
        const isPendente = ['PENDENTE', 'EM ROTA', 'INICIADO', 'PRIORIZAR'].includes(statusNormalizado);

        if (statusFiltro === 'pendente' && !isPendente) return false;
        if (statusFiltro === 'concluido' && isPendente) return false;

        return true;
    });

    const pendentes = pedidos.filter(p => {
        const s = (p.statusEntrega || 'Pendente').trim().toUpperCase();
        return ['PENDENTE', 'EM ROTA', 'INICIADO', 'PRIORIZAR'].includes(s);
    });
    const contagemAtual = pendentes.length;
    let ultimaContagem = parseInt(localStorage.getItem('entregador_contagem') || '0');

    if (contagemAtual > ultimaContagem) {
        window.tocarAlertaSonoro();
    }
    localStorage.setItem('entregador_contagem', contagemAtual);
    const totalEl = document.getElementById('totalPedidos');
    if (totalEl) totalEl.innerText = pedidos.length;

    if (statusFiltro === 'pendente' && pendentes.length > 0) {
        processarFilaGeocodificacao(pendentes);
    }

    const posAtual = window.posicaoEntregadorAtual;

    // Calcula distâncias para todos os pedidos
    pedidos.forEach(p => {
        p.distanciaMetros = null;
        p.distanciaFormatada = '';

        if (p.endereco && posAtual && posAtual.lat && posAtual.lng) {
            const cleanAddr = p.endereco
                .replace(/([a-záàãâéêíóôõúüçA-ZÁÀÃÂÉÊÍÓÔÕÚÜÇ])([A-ZÁÀÃÂÉÊÍÓÔÕÚÜÇ][a-záàãâéêíóôõúüç])/g, '$1, $2')
                .replace(/\b(apto|apartamento|bloco|casa|fundos|sala|loja|quadra|lote|portaria)\b.*$/i, '')
                .replace(/[^\w\s,]/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .toUpperCase();
            const coords = window.coordenadasMemoriaCache[cleanAddr];
            if (coords && coords.lat && coords.lng) {
                const dist = window.calcularDistanciaMetros(posAtual.lat, posAtual.lng, coords.lat, coords.lng);
                if (dist !== null && !isNaN(dist)) {
                    p.distanciaMetros = dist;
                    p.distanciaFormatada = window.formatarDistancia(dist);
                }
            }
        }
    });

    // Seleciona sugestão seguindo: 1º PRIORIZAR → 2º mais próximo → 3º mais antigo
    let sugestao = null;
    if (pendentes.length > 0) {
        // 1º: há algum marcado como PRIORIZAR?
        const prioritarios = pendentes.filter(p => (p.statusEntrega || '').trim().toUpperCase() === 'PRIORIZAR');

        if (prioritarios.length > 0) {
            // Entre os prioritários: escolhe o mais próximo, depois o mais antigo
            sugestao = prioritarios.reduce((melhor, p) => {
                if (!melhor) return p;
                const dMelhor = melhor.distanciaMetros !== null ? melhor.distanciaMetros : Infinity;
                const dP = p.distanciaMetros !== null ? p.distanciaMetros : Infinity;
                if (dP < dMelhor) return p;
                if (dP === dMelhor && (p.timestamp || 0) < (melhor.timestamp || 0)) return p;
                return melhor;
            }, null);
        } else {
            // 2º: o pedido pendente mais próximo com GPS
            const comDistancia = pendentes.filter(p => p.distanciaMetros !== null);
            if (comDistancia.length > 0) {
                sugestao = comDistancia.reduce((melhor, p) => {
                    if (!melhor) return p;
                    if (p.distanciaMetros < melhor.distanciaMetros) return p;
                    // 3º desempate: mais antigo
                    if (p.distanciaMetros === melhor.distanciaMetros && (p.timestamp || 0) < (melhor.timestamp || 0)) return p;
                    return melhor;
                }, null);
            } else {
                // 3º: sem GPS disponível - sugere o mais antigo
                sugestao = pendentes.slice().sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))[0];
            }
        }
    }

    if (statusFiltro === 'pendente' && pendentes.length > 0) {
        renderizarBannerSugestao(sugestao);
    } else {
        renderizarBannerSugestao(null);
    }

    const maisProximo = sugestao;

    // Ordenação da lista: sempre 1º PRIORIZAR, 2º distância, 3º mais antigo
    pedidos.sort((a, b) => {
        const aPrio = (a.statusEntrega || '').trim().toUpperCase() === 'PRIORIZAR' ? 1 : 0;
        const bPrio = (b.statusEntrega || '').trim().toUpperCase() === 'PRIORIZAR' ? 1 : 0;
        if (aPrio !== bPrio) return bPrio - aPrio;

        // 2º: mais próximo (sem GPS vai para o final)
        const aDist = a.distanciaMetros !== null ? a.distanciaMetros : Infinity;
        const bDist = b.distanciaMetros !== null ? b.distanciaMetros : Infinity;
        if (aDist !== bDist) return aDist - bDist;

        // 3º: mais antigo primeiro (menor timestamp = esperando há mais tempo)
        return (a.timestamp || 0) - (b.timestamp || 0);
    });

    container.innerHTML = '';
    if (pedidos.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 40px 20px; color: #888;">
            <p style="font-size: 32px; margin-bottom: 10px;">🛵</p>
            <p style="font-weight: 600;">Nenhum pedido ${statusFiltro === 'pendente' ? 'pendente' : 'concluído'} no momento.</p>
        </div>`;
        return;
    }

    pedidos.forEach(p => {
        const isMaisPerto = maisProximo && p.id === maisProximo.id;
        container.appendChild(criarCardPedido(p, isMaisPerto));
    });
};

function calcularTempo(timestamp) {
    if (!timestamp) return '0 min';
    const diff = Date.now() - timestamp;
    const min = Math.floor(diff / 60000);
    return `${min} min`;
}

function getClassCorTempo(timestamp) {
    if (!timestamp) return 'tempo-recente';
    const diff = Date.now() - timestamp;
    const min = Math.floor(diff / 60000);
    if (min < 30) return 'tempo-recente';
    if (min < 60) return 'tempo-atencao';
    return 'tempo-urgente';
}

function criarCardPedido(p, isMaisProximo) {
    const card = document.createElement('div');
    card.className = 'pedido-card';
    const status = p.statusEntrega || 'Pendente';
    const statusClass = `status-${status.toLowerCase().replace('í', 'i').replace(/\s+/g, '-')}`;

    if (status.trim().toUpperCase() === 'PRIORIZAR') {
        card.classList.add('prioridade');
    }

    const tempoDecorrido = calcularTempo(p.timestamp);
    const classeTempo = getClassCorTempo(p.timestamp);
    const isFinalizado = status === 'Concluída' || status === 'Cancelada';

    const badgeDistanciaHtml = p.distanciaFormatada ? `<span class="badge-distancia">📍 ${p.distanciaFormatada}</span>` : '';
    const badgeMaisPertoHtml = (isMaisProximo && !isFinalizado) ? `<span class="badge-mais-proximo">🎯 MAIS PERTO</span>` : '';

    card.innerHTML = `
        <div class="pedido-card-header">
            <div class="pedido-card-cliente">👤 ${p.cliente}</div>
            <div class="pedido-card-valor">R$ ${p.valor}</div>
        </div>
        <div class="pedido-card-info">
            <div class="pedido-card-row"><span class="pedido-card-icon">📍</span><span class="pedido-card-value">${p.endereco}</span></div>
            <div class="pedido-card-row"><span class="pedido-card-icon">📦</span><span class="pedido-card-value">${p.produto}</span></div>
            ${p.informacoes ? `<div class="pedido-card-row"><span class="pedido-card-icon">📝</span><span class="pedido-card-value">${p.informacoes}</span></div>` : ''}
        </div>
        <div class="pedido-card-footer">
            <span class="badge-status ${statusClass}">${status === 'Em Rota' ? 'INICIADO' : (status === 'Priorizar' ? 'PRIORIZAR' : status)}</span>
            ${badgeDistanciaHtml}
            ${badgeMaisPertoHtml}
            ${!isFinalizado ? `<span class="badge-tempo ${classeTempo}">⏱️ ${tempoDecorrido}</span>` : ''}
            <span class="pedido-card-tap-hint">👆 Detalhes</span>
        </div>
    `;
    card.onclick = () => window.mostrarDetalhesPedido(p);
    return card;
}

window.mostrarDetalhesPedido = function (p) {
    const modal = document.getElementById('modalPedidoDetalhes');
    if (!modal) return;

    document.getElementById('detalhesConteudo').innerHTML = `
        <div class="detalhe-item"><div class="detalhe-label">CLIENTE</div><div class="detalhe-valor">${p.cliente}</div></div>
        <div class="detalhe-item">
            <div class="detalhe-label">TELEFONE</div>
            <div class="detalhe-valor" style="display: flex; align-items: center; justify-content: space-between;">
                <span>${p.telefone || '-'}</span>
                ${p.telefone ? `
                    <a href="https://wa.me/55${p.telefone.replace(/\D/g, '')}" target="_blank" 
                       style="background: #25d366; color: white; text-decoration: none; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                        💬 WhatsApp
                    </a>
                ` : ''}
            </div>
        </div>
        <div class="detalhe-item"><div class="detalhe-label">ENDEREÇO</div><div class="detalhe-valor">${p.endereco}</div></div>
        <div class="detalhe-item"><div class="detalhe-label">PRODUTO</div><div class="detalhe-valor">${p.produto}</div></div>
        <div class="detalhe-item"><div class="detalhe-label">PAGAMENTO</div><div class="detalhe-valor">${p.pagamento}</div></div>
        <div class="detalhe-item"><div class="detalhe-label">VALOR</div><div class="detalhe-valor">R$ ${p.valor}</div></div>
        ${p.informacoes ? `
            <div class="detalhe-item" style="background: #fff9db; border-radius: 8px; padding: 10px; border: 1px solid #ffe066;">
                <div class="detalhe-label" style="color: #f08c00;">📝 OBSERVAÇÕES / REFERÊNCIA</div>
                <div class="detalhe-valor" style="font-weight: bold; color: #5c940d;">${p.informacoes}</div>
            </div>
        ` : ''}
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
            <button class="btn-waze" style="width:100%;" 
                onclick="if('${p.statusEntrega}' === 'Em Rota') { window.open('https://waze.com/ul?q=${encodeURIComponent(p.endereco)}', '_blank') } else { alert('⚠️ Inicie a entrega antes de abrir a rota!') }">
                📍 WAZE
            </button>
            <button class="btn-maps" style="width:100%; background: #4285F4; color: white; border: none; padding: 12px; border-radius: 10px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"
                onclick="if('${p.statusEntrega}' === 'Em Rota') { window.open('https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.endereco)}', '_blank') } else { alert('⚠️ Inicie a entrega antes de abrir a rota!') }">
                🌍 MAPS
            </button>
        </div>
    `;

    const isFinalizado = p.statusEntrega === 'Concluída' || p.statusEntrega === 'Cancelada';
    const footer = document.querySelector('.actions-footer');
    if (footer) footer.style.display = isFinalizado ? 'none' : 'flex';

    const btnIniciar = document.getElementById('btnIniciarEntrega');
    const btnConcluir = document.getElementById('btnConcluirEntrega');
    const btnCancelar = document.getElementById('btnCancelarEntrega');

    if (btnIniciar) {
        btnIniciar.style.display = p.statusEntrega === 'Em Rota' ? 'none' : 'block';
        btnIniciar.onclick = () => {
            window.statusPedido(p.id, 'Em Rota');
            window.open(`https://waze.com/ul?q=${encodeURIComponent(p.endereco)}`, '_blank');
        };
    }
    if (btnConcluir) {
        btnConcluir.style.display = p.statusEntrega === 'Em Rota' ? 'block' : 'none';
        btnConcluir.onclick = () => window.abrirModalFinalizar(p);
    }
    if (btnCancelar) {
        btnCancelar.onclick = () => window.statusPedido(p.id, 'Cancelada');
    }

    modal.style.display = 'block';
}

window.statusPedido = function (id, novoStatus) {
    update(ref(remoteDb, 'pedidos_realtime/' + id), {
        statusEntrega: novoStatus,
        [`tempo_${novoStatus.toLowerCase().replace(' ', '_')}`]: new Date().toLocaleString('pt-BR')
    }).then(() => {
        const modal = document.getElementById('modalPedidoDetalhes');
        if (modal) modal.style.display = 'none';
        window.mostrarMensagemSucesso(`Status: ${novoStatus}! ✅`);
    });
}

window.abrirModalFinalizar = function (p) {
    const modalDetalhes = document.getElementById('modalPedidoDetalhes');
    if (modalDetalhes) modalDetalhes.style.display = 'none';

    const modalFin = document.getElementById('modalFinalizarEntrega');
    if (modalFin) modalFin.style.display = 'block';

    document.getElementById('pagamentoFinalizar').value = p.pagamento || '';

    window.toggleQRCodePix(p.pagamento || '');

    document.getElementById('btnConfirmarFinalizacao').onclick = () => {
        const pag = document.getElementById('pagamentoFinalizar').value;
        const obs = document.getElementById('obsFinalizar').value;
        if (!pag) { alert("Selecione o pagamento!"); return; }

        update(ref(remoteDb, 'pedidos_realtime/' + p.id), {
            statusEntrega: 'Concluída',
            pagamento: pag,
            obs_finalizacao: obs,
            tempo_concluido: new Date().toLocaleString('pt-BR')
        }).then(() => {
            if (modalFin) modalFin.style.display = 'none';
            window.mostrarMensagemSucesso("Entrega Concluída! 🏁");
        });
    };
}

window.toggleQRCodePix = function (pagamento) {
    const qrContainer = document.getElementById('qrCodePixContainer');
    if (!qrContainer) return;
    if (pagamento && pagamento.includes('PIX')) {
        qrContainer.style.display = 'block';
    } else {
        qrContainer.style.display = 'none';
    }
}

window.toggleQRCodePixVenda = function (pagamento) {
    const qrContainer = document.getElementById('qrCodePixVendaContainer');
    if (!qrContainer) return;

    if (pagamento && pagamento.includes('PIX')) {
        qrContainer.style.display = 'block';
    } else {
        qrContainer.style.display = 'none';
    }
}

window.mascaraTelefoneVenda = function (campo) {
    let valor = campo.value.replace(/\D/g, "");
    if (valor.length > 0) valor = "(" + valor;
    if (valor.length > 3) valor = valor.slice(0, 3) + ") " + valor.slice(3);
    if (valor.length > 10) valor = valor.slice(0, 10) + "-" + valor.slice(10, 15);
    else if (valor.length > 9) valor = valor.slice(0, 9) + "-" + valor.slice(9);
    campo.value = valor;

    if (valor.length >= 14) {
        window.buscarClientePorTelefoneVenda(valor);
    }
}

window.buscarClientePorTelefoneVenda = function (tel) {
    if (!window.pedidosCache) return;
    const ultimo = [...window.pedidosCache].reverse().find(p => p.telefone === tel);
    if (ultimo) {
        document.getElementById('vendaCliente').value = ultimo.cliente || '';
        window.mostrarMensagemSucesso("✅ Cliente encontrado!");
    }
}

window.mascaraMoedaVenda = function (campo) {
    let valor = campo.value.replace(/\D/g, "");
    valor = (valor / 100).toFixed(2) + "";
    valor = valor.replace(".", ",");
    valor = valor.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    campo.value = valor;
}

function atualizarDatalistVenda() {
    const listNomes = document.getElementById('listaClientesVenda');
    const listTels = document.getElementById('listaTelefonesVenda');
    if (!listNomes || !listTels) return;
    listNomes.innerHTML = '';
    listTels.innerHTML = '';
    if (!window.pedidosCache) return;
    const nomes = new Set();
    const tels = new Set();
    window.pedidosCache.forEach(p => {
        if (p.cliente) nomes.add(p.cliente.trim().toUpperCase());
        if (p.telefone) tels.add(p.telefone.trim());
    });
    nomes.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n;
        listNomes.appendChild(opt);
    });
    tels.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        listTels.appendChild(opt);
    });
}

window.abrirModalVenda = function () {
    atualizarDatalistVenda();
    document.getElementById('vendaCliente').value = '';
    document.getElementById('vendaTelefone').value = '';
    document.getElementById('vendaCanal').value = 'VENDA MOBILE';
    document.getElementById('vendaQtd').value = '1';
    document.getElementById('vendaProduto').value = 'Gás 13kg';
    document.getElementById('vendaPagamento').value = '';
    document.getElementById('vendaValor').value = '';

    if (document.getElementById('qrCodePixVendaContainer')) {
        document.getElementById('qrCodePixVendaContainer').style.display = 'none';
    }
    const modal = document.getElementById('modalVendaDireta');
    if (modal) modal.style.display = 'block';
}

async function capturarGPS() {
    return new Promise((resolve) => {
        if (!('geolocation' in navigator)) {
            console.warn('GPS não disponível');
            resolve({ lat: 0, lng: 0 });
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                });
            },
            (err) => {
                console.warn('Erro ao capturar GPS:', err);
                resolve({ lat: 0, lng: 0 });
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    });
}

async function decrementarEstoque(produto, quantidade) {
    try {
        const hojeChave = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        const estoqueRef = ref(remoteDb, 'estoque_v2/' + hojeChave);
        const snapshot = await get(estoqueRef);
        if (!snapshot.exists()) {
            console.warn('Estoque do dia não encontrado. Venda registrada sem decremento.');
            return;
        }
        const estoqueAtual = snapshot.val();
        let updates = {};
        if (produto.includes('Gás 13kg')) {
            updates.init_g13_cheio = Math.max(0, (estoqueAtual.init_g13_cheio || 0) - quantidade);
        } else if (produto.includes('Água')) {
            updates.init_agua_cheia = Math.max(0, (estoqueAtual.init_agua_cheia || 0) - quantidade);
        }
        await update(estoqueRef, updates);
        console.log('✅ Estoque decrementado:', updates);
    } catch (error) {
        console.error('Erro ao decrementar estoque:', error);
    }
}

window.salvarVendaDireta = async function () {
    const cliente = document.getElementById('vendaCliente').value.trim();
    const telefone = document.getElementById('vendaTelefone').value.trim();
    const canal = document.getElementById('vendaCanal').value;
    const qtd = parseInt(document.getElementById('vendaQtd').value) || 1;
    const produto = document.getElementById('vendaProduto').value;
    const pagamento = document.getElementById('vendaPagamento').value;
    const valor = document.getElementById('vendaValor').value.trim();
    const entregador = localStorage.getItem('userName');

    if (!cliente) { alert('Preencha o nome do cliente!'); return; }
    if (!pagamento) { alert('Selecione a forma de pagamento!'); return; }
    if (!valor) { alert('Preencha o valor da venda!'); return; }

    try {
        window.mostrarMensagemSucesso('📍 Capturando localização...');
        const gps = await capturarGPS();
        const now = new Date();
        const dataFormatada = now.toLocaleDateString('pt-BR') + ', ' + now.toLocaleTimeString('pt-BR');

        const pedido = {
            cliente: cliente,
            telefone: telefone || '-',
            endereco: 'VENDA MOBILE',
            produto: `${qtd}x ${produto}`,
            qtd: qtd,
            pagamento: pagamento,
            valor: valor,
            entregador: entregador,
            canal: 'VENDA ENTREGADOR',
            tipoVenda: 'VENDA MOBILE',
            statusEntrega: 'Concluída',
            data: dataFormatada,
            timestamp: Date.now(),
            gps: gps,
            tempo_concluido: dataFormatada,
            informacoes: `Venda direta - VENDA MOBILE`
        };

        const pedidosRef = ref(remoteDb, 'pedidos_realtime');
        await push(pedidosRef, pedido);
        await decrementarEstoque(produto, qtd);

        const modal = document.getElementById('modalVendaDireta');
        if (modal) modal.style.display = 'none';
        window.mostrarMensagemSucesso('✅ Venda registrada com sucesso!');
        console.log('✅ Venda salva:', pedido);
    } catch (error) {
        console.error('Erro ao salvar venda:', error);
        alert('Erro ao registrar venda: ' + error.message);
    }
}

// Initial timer
let countdown = 30;
setInterval(() => {
    countdown--;
    const timerEl = document.getElementById('refreshTimer');
    if (timerEl) timerEl.innerText = `🔄 ${countdown}s`;
    if (countdown <= 0) { countdown = 30; window.renderizarTabelaPorData(); }
}, 1000);

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        console.log("👁️ App Visível: Reforçando conexões...");
        if (window.iniciarEscutaTempoReal) window.iniciarEscutaTempoReal();
    }
    window.iniciarKeepAlive();
});

document.addEventListener('click', () => {
    window.iniciarKeepAlive();
});

window.addEventListener('load', () => {
    window.verificarSessao();
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('👷 SW: Registrado para entregador', reg.scope))
            .catch(err => console.error('❌ SW: Falha', err));
    }
});
