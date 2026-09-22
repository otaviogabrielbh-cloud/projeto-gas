// Módulo principal do aplicativo
import { remoteDb, ref, set, get } from './firebase-config.js';

let db;
let pedidosFiltradosGlobal = [];
const DB_NAME = "CanoasGasDB";
const STORE_NAME = "pedidos";

// Inicialização do IndexedDB
const request = indexedDB.open(DB_NAME, 1);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
    }
};

request.onsuccess = (e) => {
    db = e.target.result;
    inicializar();
};

request.onerror = (e) => {
    console.error("Erro ao abrir banco de dados local:", e);
    alert("Erro ao carregar o sistema localmente.");
};

function inicializar() {
    inicializarDatas();
    renderizarTabelaPorData();
    atualizarDatalist();
    configurarEventos();
}

// ============================================================================
// LÓGICA DE DADOS (IndexedDB & Firebase)
// ============================================================================

async function exportarParaNuvem() {
    if (!confirm("Deseja salvar todo o histórico local na nuvem?")) return;

    mostrarCarregando(true);
    try {
        const pedidos = await getAllPedidos();
        await set(ref(remoteDb, 'backup_pedidos'), pedidos);
        mostrarMensagemSucesso("Backup realizado na nuvem! ☁️");
    } catch (error) {
        console.error(error);
        alert("Erro ao salvar na nuvem: " + error.message);
    } finally {
        mostrarCarregando(false);
    }
}

async function importarDaNuvem() {
    if (!confirm("Deseja substituir/mesclar os dados locais com os da nuvem?")) return;

    mostrarCarregando(true);
    try {
        const snapshot = await get(ref(remoteDb, 'backup_pedidos'));
        if (snapshot.exists()) {
            const pedidosNuvem = snapshot.val();
            const pedidosLocais = await getAllPedidos();

            // Cria um Set de chaves unicas para evitar duplicatas (Data + Cliente + Endereco)
            const chavesLocais = new Set(pedidosLocais.map(p => gerarChaveUnica(p)));

            const tx = db.transaction([STORE_NAME], "readwrite");
            const store = tx.objectStore(STORE_NAME);

            let novos = 0;
            pedidosNuvem.forEach(p => {
                if (!chavesLocais.has(gerarChaveUnica(p))) {
                    const pNovo = { ...p };
                    delete pNovo.id; // Remove ID antigo para gerar um novo localmente
                    store.add(pNovo);
                    novos++;
                }
            });

            tx.oncomplete = () => {
                renderizarTabelaPorData();
                atualizarDatalist();
                alert(`${novos} novos pedidos importados! 🔄`);
            };
        } else {
            alert("Nenhum backup encontrado na nuvem.");
        }
    } catch (error) {
        console.error(error);
        alert("Erro ao baixar dados da nuvem.");
    } finally {
        mostrarCarregando(false);
    }
}

function gerarChaveUnica(p) {
    // Normaliza strings para evitar duplicatas por pequenos erros de digitação/espaço
    return `${(p.data || '').trim()}-${(p.cliente || '').trim()}-${(p.endereco || '').trim()}`.toLowerCase();
}

function getAllPedidos() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ============================================================================
// LÓGICA DE UI E DOM
// ============================================================================

function inicializarDatas() {
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('dataInicio').value = hoje;
    document.getElementById('dataFim').value = hoje;
}

function renderizarTabelaPorData() {
    const corpoTabela = document.getElementById('corpoTabela');
    const dInic = document.getElementById('dataInicio').value;
    const dFim = document.getElementById('dataFim').value;
    const busca = document.getElementById('inputBusca').value.toUpperCase().trim();

    // Tratamento de fuso e datas
    const dataInicioFiltro = dInic ? new Date(dInic + 'T00:00:00') : new Date(0);
    const dataFimFiltro = dFim ? new Date(dFim + 'T23:59:59') : new Date();

    corpoTabela.innerHTML = ''; // Limpa tabela (Pode ser otimizado futuramente)

    getAllPedidos().then(pedidos => {
        const processarData = (str) => {
            // Formato esperado: "dd/mm/aaaa, hh:mm:ss" ou "dd/mm/aaaa hh:mm:ss"
            try {
                const [dataPart, horaPart] = str.split(/[\s,]+/);
                const [d, m, y] = dataPart.split('/');
                return new Date(`${y}-${m}-${d}T${horaPart || '00:00:00'}`);
            } catch (e) {
                return new Date(0); // Data inválida vai pro final/início
            }
        };

        pedidosFiltradosGlobal = pedidos.filter(p => {
            const dataPedido = processarData(p.data);
            const bateData = dataPedido >= dataInicioFiltro && dataPedido <= dataFimFiltro;

            if (!bateData) return false;

            if (!busca) return true; // Se não tem busca e bateu data, retorna true

            // Busca textual inteligente (concatena campos chave)
            const texto = [
                p.cliente,
                p.telefone,
                p.endereco,
                p.canalVenda,
                p.entregador,
                p.produto
            ].join(' ').toUpperCase();

            return texto.includes(busca);
        });

        // Ordenação: Mais recente primeiro
        pedidosFiltradosGlobal.sort((a, b) => processarData(b.data) - processarData(a.data));

        // Renderiza
        // DocumentFragment para melhor performance (só um reflow)
        const fragment = document.createDocumentFragment();
        pedidosFiltradosGlobal.forEach(p => {
            fragment.appendChild(criarLinhaTabela(p));
        });
        corpoTabela.appendChild(fragment);

        document.getElementById('totalPedidos').innerText = pedidosFiltradosGlobal.length;
    });
}

function criarLinhaTabela(p) {
    const infoStatus = calcularStatusRetencao(p.data, p.duracaoGas);
    const tr = document.createElement("tr");
    if (infoStatus.classe) tr.className = infoStatus.classe;

    // Criação segura de células (XSS Prevention)
    // Helper para criar TD
    const hTd = (text, isHtml = false) => {
        const td = document.createElement('td');
        if (isHtml) td.innerHTML = text; // Somente use se estritamente necessário e seguro
        else td.textContent = text;
        return td;
    };

    tr.appendChild(hTd(p.data));
    tr.appendChild(hTd(p.cliente));
    tr.appendChild(hTd(p.telefone));
    tr.appendChild(hTd(p.canalVenda || '-'));
    tr.appendChild(hTd(p.produto));

    const tdEntregador = hTd(p.entregador || '-');
    tdEntregador.style.fontWeight = 'bold';
    tr.appendChild(tdEntregador);

    const tdEndereco = hTd('');
    tdEndereco.textContent = p.endereco ? p.endereco.substring(0, 30) + (p.endereco.length > 30 ? '...' : '') : '';
    tdEndereco.title = p.endereco || '';
    tr.appendChild(tdEndereco);

    tr.appendChild(hTd(`R$ ${p.valor}`));
    tr.appendChild(hTd(p.duracaoGas ? p.duracaoGas + ' d' : '-'));
    tr.appendChild(hTd(infoStatus.texto));

    // Ações
    const tdAcoes = document.createElement('td');
    tdAcoes.className = "no-excel col-acoes";

    const criarBotao = (emoji, title, cls, onClick) => {
        const btn = document.createElement('button');
        btn.textContent = emoji;
        btn.title = title;
        btn.className = cls;
        btn.onclick = (e) => { e.stopPropagation(); onClick(p); };
        return btn;
    };

    tdAcoes.appendChild(criarBotao('🛢️', 'Lembrete Recompra', 'btn-recompra', () => copiarMensagemRecompra(p)));
    tdAcoes.appendChild(criarBotao('💬', 'Copiar Mensagem Original', 'btn-re-copiar', () => copiarTextoParaClipboard(p.msgGerada)));
    tdAcoes.appendChild(criarBotao('✏️', 'Editar Pedido', 'btn-editar', () => carregarParaEdicao(p)));
    tdAcoes.appendChild(criarBotao('X', 'Excluir Pedido', 'btn-excluir', () => excluirPedido(p.id)));

    tr.appendChild(tdAcoes);
    return tr;
}

function calcularStatusRetencao(dataCompraStr, duracao) {
    if (!duracao || duracao <= 0) return { texto: "-", classe: "" };

    try {
        const [dataPart] = dataCompraStr.split(/[\s,]+/);
        const [d, m, y] = dataPart.split('/');
        const dataCompra = new Date(`${y}-${m}-${d}`);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const diffTime = Math.abs(hoje - dataCompra);
        const diasPassados = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const diasRestantes = duracao - diasPassados;

        if (diasRestantes <= 0) return { texto: "⚠️", classe: "status-vencido" };
        if (diasRestantes <= 3) return { texto: "⏳", classe: "status-vencendo" };
        return { texto: "✅", classe: "" };
    } catch (e) {
        return { texto: "?", classe: "" };
    }
}

// ============================================================================
// OPERAÇÕES DE PEDIDO (CRUD)
// ============================================================================

function gerarPedido() {
    const $ = (id) => document.getElementById(id).value;

    // Validação Básica
    const nome = $('nome').trim();
    const endereco = $('endereco').trim();
    const valor = $('valor').trim();

    if (!nome || !endereco || !valor) {
        alert("Campos obrigatórios: Nome, Endereço e Valor.");
        return;
    }

    const dados = {
        data: new Date().toLocaleString('pt-BR'),
        cliente: nome,
        telefone: $('telefone') || "Não informado",
        canalVenda: $('canalVenda'),
        produto: $('produto'),
        endereco: endereco,
        informacoes: $('informacoes'),
        entregador: $('entregador'),
        pagamento: $('pagamento'),
        valor: valor,
        duracaoGas: $('duracaoGas'),
    };

    // Gera mensagens
    const linkWaze = "https://waze.com/ul?q=" + encodeURIComponent(dados.endereco);
    const linkMaps = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(dados.endereco);

    const textoEntregador = `ORDEM DE ENTREGA\n\n🛵 Entregador: ${dados.entregador}\n-------------------------------\n👤 Cliente: ${dados.cliente}\n🛒 Canal: ${dados.canalVenda}\n📞 Tel: ${dados.telefone}\n🚚 Endereço: ${dados.endereco}\n📦 Produto: ${dados.produto}\n📝 Info: ${dados.informacoes}\n💳 Pagamento: ${dados.pagamento}\n💵 Valor: R$ ${dados.valor}\n-------------------------------\n\n📍 Waze: ${linkWaze}\n📍 Google Maps: ${linkMaps}`;

    const textoCliente = `Olá, ${dados.cliente}! 👋\n\nSeu pedido de gás ou água, via ${dados.canalVenda}, está a caminho!\n\n🛵 Entregador: ${dados.entregador}\n-------------------------------\n\n👤 Cliente: ${dados.cliente}\n📞 Tel: ${dados.telefone}\n🚚 Endereço: ${dados.endereco}\n📦 Produto: ${dados.produto}\n📝 Info: ${dados.informacoes}\n💳 Pagamento: ${dados.pagamento}\n💵 Valor: R$ ${dados.valor}\n\nContato da revenda: 31-98255 7807 \n-------------------------------\n\nO tempo da entrega aproximado de 35 minutos.\n\nCanoas gás agradece!`;

    dados.msgGerada = textoCliente;

    // Salva no Banco Local
    const tx = db.transaction([STORE_NAME], "readwrite");
    tx.objectStore(STORE_NAME).add(dados);

    tx.oncomplete = () => {
        // Atualiza UI
        const setTxt = (id, txt) => {
            const el = document.getElementById(id);
            el.innerText = txt;
            el.style.display = 'block';
        }

        setTxt('resultado', textoEntregador);
        setTxt('msgCliente', textoCliente);

        // Mostra botões e seções ocultas
        document.querySelectorAll('.secao-titulo, .btn-copiar').forEach(el => el.style.display = 'block');

        renderizarTabelaPorData();
        atualizarDatalist();

        // Feedback visual simples
        document.getElementById('topo').scrollIntoView({ behavior: 'smooth' });
    };
}

function excluirPedido(id) {
    if (confirm("Tem certeza que deseja excluir este pedido do histórico?")) {
        const tx = db.transaction([STORE_NAME], "readwrite");
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => renderizarTabelaPorData();
    }
}

function carregarParaEdicao(p) {
    // Preenche campos
    const setVal = (id, val) => { if (document.getElementById(id)) document.getElementById(id).value = val || ''; }

    setVal('nome', p.cliente);
    setVal('telefone', p.telefone);
    setVal('endereco', p.endereco);
    setVal('produto', p.produto);
    setVal('valor', p.valor);
    setVal('duracaoGas', p.duracaoGas);
    setVal('pagamento', p.pagamento);
    setVal('canalVenda', p.canalVenda);
    setVal('entregador', p.entregador);
    setVal('informacoes', p.informacoes);

    document.getElementById('topo').scrollIntoView({ behavior: 'smooth' });
}

// ============================================================================
// UTILITÁRIOS E HELPERS
// ============================================================================

function copiarTextoParaClipboard(texto) {
    if (!texto) return;
    navigator.clipboard.writeText(texto).then(() => {
        mostrarMensagemSucesso("Texto copiado! ✅");
    }).catch(err => {
        console.error("Erro ao copiar", err);
        alert("Não foi possível copiar automaticamente.");
    });
}

function copiarMensagemRecompra(p) {
    const dataSomente = p.data.split(' ')[0]; // Pega só a data
    const nome = p.cliente.split(' ')[0]; // Só o primeiro nome para ser mais pessoal

    const msg = `Olá, ${p.cliente}! 😊\n\nPassando para lembrar que o seu gás pode estar acabando. 🕒\nSua última compra foi em: ${dataSomente}.\n\nPara não ficar na mão, é só responder essa mensagem que entregamos rapidinho! 🔥\n\n*Canoas Gás*`;

    copiarTextoParaClipboard(msg);
}

function mascaraMoeda(campo) {
    let valor = campo.value.replace(/\D/g, "");
    valor = (valor / 100).toFixed(2) + "";
    valor = valor.replace(".", ",");
    valor = valor.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    campo.value = valor;
}

function mascaraTelefone(campo) {
    let valor = campo.value.replace(/\D/g, "");
    if (valor.length > 0) valor = "(" + valor;
    if (valor.length > 3) valor = valor.slice(0, 3) + ") " + valor.slice(3);
    if (valor.length > 10) valor = valor.slice(0, 10) + "-" + valor.slice(10, 15);
    else if (valor.length > 9) valor = valor.slice(0, 9) + "-" + valor.slice(9);
    campo.value = valor;

    // Auto-busca ao terminar de digitar (tamanho min de celular com DDD)
    if (valor.length >= 14) {
        buscarUltimoPedidoPorTelefone(valor);
    }
}

function buscarUltimoPedidoPorTelefone(tel) {
    // Busca simples e ineficiente, mas funcional para volume atual.
    // Ideal: Criar índice 'telefone' no IndexedDB
    getAllPedidos().then(pedidos => {
        // Encontra o último pedido deste telefone
        const ultimo = pedidos.reverse().find(p => p.telefone === tel);
        if (ultimo) {
            // Preenche dados automaticamente se encontrar
            // Usamos um flash ou toast para avisar o usuário
            carregarParaEdicao(ultimo); // Reusa lógica de preencher
            mostrarMensagemSucesso("Dados do cliente encontrados! 🔍");
        }
    });
}

function atualizarDatalist() {
    Promise.all([
        getAllPedidos(),
        get(ref(remoteDb, 'clientes')).then(snap => snap.val() || {}).catch(() => ({}))
    ]).then(([pedidos, clientesData]) => {
        const nomes = new Set(pedidos.map(p => p.cliente));
        const tels = new Set(pedidos.map(p => p.telefone));

        Object.values(clientesData).forEach(c => {
            if (c.nome) nomes.add(c.nome.trim().toUpperCase());
            if (c.cliente) nomes.add(c.cliente.trim().toUpperCase());
            if (c.tel) tels.add(c.tel.trim());
            if (c.telefone) tels.add(c.telefone.trim());
        });

        const clientesUnicos = [...nomes].filter(Boolean).sort();
        const telefonesUnicos = [...tels].filter(Boolean).sort();

        const preencherDataList = (id, lista) => {
            const dl = document.getElementById(id);
            if (!dl) return;
            dl.innerHTML = '';
            lista.forEach(item => {
                if (item) {
                    const opt = document.createElement('option');
                    opt.value = item;
                    dl.appendChild(opt);
                }
            });
        };

        preencherDataList('listaClientes', clientesUnicos);
        preencherDataList('listaTelefones', telefonesUnicos);
    });
}

function mostrarMensagemSucesso(txt) {
    const msg = document.getElementById('msgCopiado');
    msg.innerText = txt || "Sucesso! ✅";
    msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 3000);
}

function mostrarCarregando(show) {
    const btn = document.getElementById('btnGerar'); // Usamos o botão principal como indicador
    if (show) {
        btn.dataset.originalText = btn.innerText;
        btn.innerText = "Processando... ⏳";
        btn.disabled = true;
        document.body.style.cursor = 'wait';
    } else {
        if (btn.dataset.originalText) btn.innerText = btn.dataset.originalText;
        btn.disabled = false;
        document.body.style.cursor = 'default';
    }
}

// ============================================================================
// RELATÓRIOS E FATURAMENTO
// ============================================================================

function processarFaturamento() {
    // Usa a lista global filtrada
    let total = 0;
    const porForma = {};
    const porEntregador = {};

    pedidosFiltradosGlobal.forEach(p => {
        const v = parseFloat(p.valor.replace(/\./g, '').replace(',', '.')) || 0;
        total += v;

        // Agregado Pagamento
        const pag = p.pagamento || 'OUTROS';
        porForma[pag] = (porForma[pag] || 0) + v;

        // Agregado Entregador
        const ent = p.entregador || 'NÃO DEFINIDO';
        if (!porEntregador[ent]) porEntregador[ent] = { total: 0, formas: {} };
        porEntregador[ent].total += v;
        porEntregador[ent].formas[pag] = (porEntregador[ent].formas[pag] || 0) + v;
    });

    // Renderizar
    document.getElementById('fatTotalGeral').innerText = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Render Lista Pagamentos
    const divPag = document.getElementById('listaPagamentos');
    divPag.innerHTML = Object.keys(porForma).sort().map(k => `
        <div class="item-fat">
            <span>${k}</span>
            <b>${porForma[k].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b>
        </div>
    `).join('');

    // Render Lista Entregadores
    const divEnt = document.getElementById('listaEntregadores');
    divEnt.innerHTML = Object.keys(porEntregador).sort().map(k => `
        <div style="background:#f1f1f1; border-radius:8px; padding:10px; margin-bottom:10px;">
            <div class="item-fat" style="border-bottom:1px solid #ddd; margin-bottom:5px;">
                <span style="font-weight:bold;">🛵 ${k}</span>
                <span style="font-weight:bold; color:#007bff;">${porEntregador[k].total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
            ${Object.keys(porEntregador[k].formas).map(f => `
                <div style="font-size:12px; display:flex; justify-content:space-between; color:#555;">
                    <span>${f}</span>
                    <span>${porEntregador[k].formas[f].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
            `).join('')}
        </div>
    `).join('');

    document.getElementById('modalFaturamento').style.display = 'block';
}

function gerarPrevisaoRetencao() {
    // Filtra clientes com gás ativo (restante > 0)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const ativos = pedidosFiltradosGlobal.filter(p => {
        if (!p.duracaoGas || p.duracaoGas <= 0) return false;
        try {
            const [dataPart] = p.data.split(/[\s,]+/);
            const [d, m, y] = dataPart.split('/');
            const dataCompra = new Date(`${y}-${m}-${d}`);
            const diasPassados = Math.ceil(Math.abs(hoje - dataCompra) / (1000 * 60 * 60 * 24));
            return (p.duracaoGas - diasPassados) > 0;
        } catch { return false; }
    });

    if (ativos.length === 0) {
        alert("Nenhum cliente com gás ativo encontrado para os filtros atuais.");
        return;
    }

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
        + "Cliente,Telefone,Endereco,Data Compra,Dias Restantes\n"
        + ativos.map(p => {
            // Recalcula dias para o relatório
            const [d, m, y] = p.data.split(/[\s,]+/)[0].split('/');
            const dataCompra = new Date(`${y}-${m}-${d}`);
            const diasPassados = Math.ceil(Math.abs(hoje - dataCompra) / (1000 * 60 * 60 * 24));
            const restantes = p.duracaoGas - diasPassados;
            return `"${p.cliente}","${p.telefone}","${p.endereco}","${p.data}","${restantes}"`;
        }).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "previsao_recompra_gas.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportarExcel() {
    const dados = pedidosFiltradosGlobal || [];
    if (dados.length === 0) {
        alert('Nenhum dado para exportar. Verifique os filtros aplicados.');
        return;
    }

    // Cabeçalho — formato solicitado
    const cabecalho = [
        'Data', 'Produto', 'Valor', '', '',
        'Pagamento', 'Canal de Venda', 'Entregador', 'Endereço'
    ];

    // Ordenar primeiramente por data (mais antiga primeiro) e secundariamente por entregador do dia
    const dadosOrdenados = [...dados].sort((a, b) => {
        const parseDate = (str) => {
            const [dataPart] = (str || '').split(/[\s,]+/);
            const [d, m, y] = (dataPart || '').split('/');
            return new Date(`${y}-${m}-${d}`);
        };
        const compData = parseDate(a.data) - parseDate(b.data);
        if (compData !== 0) return compData;

        const entA = (a.entregador || '').trim().toLowerCase();
        const entB = (b.entregador || '').trim().toLowerCase();
        return entA.localeCompare(entB, 'pt-BR');
    });

    // Montar linhas de dados com telefone após o endereço
    const linhas = dadosOrdenados.map(p => {
        const end = p.endereco || '';
        const numTel = (p.telefone || p.tel || '').trim();
        const telStr = numTel ? ` - ${numTel}` : '';
        const enderecoComTelefone = end + telStr;

        let prod = p.produto || '';
        if (prod.trim().toUpperCase() === 'GÁS 13KG' || prod.trim().toUpperCase() === '1X GÁS 13KG' || prod.trim() === 'Gás 13kg' || prod.trim() === '1x Gás 13kg') {
            prod = 'SUPERGASBRAS';
        }

        // Extrair somente DD/MM/AAAA da string de data/hora
        const dataApenas = (p.data || '').split(/[\s,]+/)[0] || '';

        return [
            dataApenas,
            prod,
            p.valor || '',
            '',
            '',
            p.pagamento || '',
            p.canalVenda || '',
            p.entregador || '',
            enderecoComTelefone
        ];
    });

    // Calcular totalizadores ao final
    const totalValor = dados.reduce((acc, p) => {
        const v = parseFloat((p.valor || '0').replace(/\./g, '').replace(',', '.')) || 0;
        return acc + v;
    }, 0);

    // Montar HTML da tabela para XLS (melhor compatibilidade com Excel pt-BR)
    const estiloTh = 'style="background:#2d3436;color:#fff;font-weight:bold;padding:10px 8px;border:1px solid #ccc;white-space:nowrap;"';
    const estiloTd = 'style="padding:8px;border:1px solid #ddd;vertical-align:middle;"';
    const estiloTdNum = 'style="padding:8px;border:1px solid #ddd;vertical-align:middle;text-align:right;"';
    const estiloTdTotal = 'style="padding:8px;border:1px solid #ccc;background:#f1f2f6;font-weight:bold;"';
    const estiloTotalNum = 'style="padding:8px;border:1px solid #ccc;background:#f1f2f6;font-weight:bold;text-align:right;"';

    let html = `<table border="1" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;width:100%;">
<thead><tr>${cabecalho.map(h => `<th ${estiloTh}>${h}</th>`).join('')}</tr></thead>
<tbody>`;

    linhas.forEach(row => {
        html += '<tr>';
        row.forEach((cell, i) => {
            const isNum = i === 2; // coluna Valor
            html += `<td ${isNum ? estiloTdNum : estiloTd}>${String(cell).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td>`;
        });
        html += '</tr>';
    });

    // Linha de totais
    const totalFormatado = totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    html += `<tr>
        <td ${estiloTdTotal} colspan="2">TOTAL — ${dados.length} pedido(s)</td>
        <td ${estiloTotalNum}>${totalFormatado}</td>
        <td ${estiloTdTotal} colspan="6"></td>
    </tr>`;

    html += '</tbody></table>';

    const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel' });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "relatorio_vendas.xls";
    a.click();
}

// ============================================================================
// CONFIGURAÇÃO DE EVENTOS
// ============================================================================
function configurarEventos() {
    document.getElementById('btnGerar').addEventListener('click', gerarPedido);

    // Inputs de máscara
    const inpValor = document.getElementById('valor');
    inpValor.addEventListener('input', () => mascaraMoeda(inpValor));

    const inpTel = document.getElementById('telefone');
    inpTel.addEventListener('input', () => mascaraTelefone(inpTel));

    // Filtros
    document.getElementById('btnFiltrar').addEventListener('click', renderizarTabelaPorData);
    document.getElementById('inputBusca').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') renderizarTabelaPorData();
    });

    // Cloud e Ferramentas
    document.getElementById('btnExportCloud').addEventListener('click', exportarParaNuvem);
    document.getElementById('btnImportCloud').addEventListener('click', importarDaNuvem);
    document.getElementById('btnFaturamento').addEventListener('click', processarFaturamento);
    document.getElementById('btnRetencao').addEventListener('click', gerarPrevisaoRetencao);
    document.getElementById('btnExcel').addEventListener('click', exportarExcel);

    // Botões de Cópia UI
    document.getElementById('btnCopiarEntrega').addEventListener('click', () => {
        copiarTextoParaClipboard(document.getElementById('resultado').innerText);
    });

    document.getElementById('btnCopiarCliente').addEventListener('click', () => {
        copiarTextoParaClipboard(document.getElementById('msgCliente').innerText);
    });

    // Limpar
    document.getElementById('btnLimpar').addEventListener('click', () => {
        const ids = ['nome', 'telefone', 'endereco', 'valor', 'informacoes', 'duracaoGas'];
        ids.forEach(id => document.getElementById(id).value = '');
        document.querySelectorAll('.secao-titulo, .btn-copiar, #resultado, #msgCliente').forEach(el => el.style.display = 'none');
    });

    // Modal Fechar
    document.getElementById('closeModal').addEventListener('click', () => {
        document.getElementById('modalFaturamento').style.display = 'none';
    });

    // Fechar modal clicando fora
    window.onclick = (event) => {
        if (event.target == document.getElementById('modalFaturamento')) {
            document.getElementById('modalFaturamento').style.display = 'none';
        }
    };
}
