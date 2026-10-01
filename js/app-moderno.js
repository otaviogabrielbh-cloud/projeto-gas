import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, onValue, push, remove, update, onDisconnect, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB-4XspbY5GalueBG8JGUJ7BfdQvPh8d1c",
  authDomain: "canoas-gas.firebaseapp.com",
  databaseURL: "https://canoas-gas-default-rtdb.firebaseio.com",
  projectId: "canoas-gas",
  storageBucket: "canoas-gas.firebasestorage.app",
  messagingSenderId: "657432003828",
  appId: "1:657432003828:web:40c6eca9096896f955caa1",
  measurementId: "G-3SMNWNELJ5"
};
const app = initializeApp(firebaseConfig);
const remoteDb = getDatabase(app);

const STORE_PASSWORD = "394105";
let todosPedidosFirebase = [];
let pedidosFiltradosGlobal = [];
let equipeEntregadores = [];
let clientesBlacklist = {};
let clientesCadastradosGlobais = {};
let contagemEnderecos = {};
let pedidoPendenteRateio = null;
window.pedidosJaImpressosNaEntrega = new Set();
window.realtimeCargaInicialCompleta = false;

const parseValor = v => parseFloat(String(v||'0').replace(/\./g,'').replace(',','.'))||0;
const fmtMoeda = v => (v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

// ========== THEME ==========
(function(){const t=localStorage.getItem('temaPreferido');if(t)document.body.className=t;})();
function mudarTema(c){document.body.className=c;localStorage.setItem('temaPreferido',c);document.getElementById('configPopup').style.display='none';}

// ========== LOGIN ==========
function login(role){
  document.getElementById('mainRoleButtons').classList.add('hidden');
  if(role==='loja'){document.getElementById('passwordSection').classList.remove('hidden');document.getElementById('loginPassword').focus();}
  else document.getElementById('delivererSection').classList.remove('hidden');
}
function cancelarLogin(){
  ['mainRoleButtons','passwordSection','delivererSection','lojaChoiceSection','teamManagementSection'].forEach(id=>document.getElementById(id).classList.add('hidden'));
  document.getElementById('loginPassword').value='';
  if(localStorage.getItem('userRole')==='loja'){document.getElementById('loginScreen').classList.add('hidden');document.getElementById('appBody').classList.remove('hidden');}
}
function confirmarSenhaLoja(){
  if(document.getElementById('loginPassword').value===STORE_PASSWORD){document.getElementById('passwordSection').classList.add('hidden');document.getElementById('lojaChoiceSection').classList.remove('hidden');}
  else alert("Senha incorreta!");
}
function acessarModulo(modulo){
  if(modulo==='gestao'){location.href='gestao.html';return;}
  if(modulo==='financeiro'){location.href='financeiro.html';return;}
  if(modulo==='estoque'){location.href='estoque.html';return;}
  if(modulo==='estoque_atual'){location.href='estoque-atual.html';return;}
  if(modulo==='clientes'){location.href='canoas_gas_customer_management.html';return;}
  if(modulo==='conciliacao'){location.href='conciliacao.html';return;}
  if(modulo==='equipe'){
    document.getElementById('appBody').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    ['mainRoleButtons','passwordSection','lojaChoiceSection'].forEach(id=>document.getElementById(id).classList.add('hidden'));
    document.getElementById('teamManagementSection').classList.remove('hidden');
    return;
  }
  efetuarLogin('loja');
}
function logout(){
  if(confirm("Deseja sair do sistema?")){
    ['userRole','userName','printConfig_pagamentos','printConfig_automatico','printConfig_naEntrega','printConfig_paperSize','ultimaContagemPendentes','admin_ultimaContagemConcluidos','temaPreferido'].forEach(k=>localStorage.removeItem(k));
    location.reload();
  }
}
function efetuarLogin(role,userName=''){
  localStorage.setItem('userRole',role);
  localStorage.setItem('userName',userName);
  if(role==='entregador'){location.href='entregador.html';return;}
  aplicarPermissoes(role,userName);
  inicializarApp();
}
function efetuarLoginEntregador(name){efetuarLogin('entregador',(name||'').trim().toUpperCase());}
function aplicarPermissoes(role,userName){
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appBody').classList.remove('hidden');
  document.body.setAttribute('data-role',role);
}
function verificarSessao(){
  const role=localStorage.getItem('userRole');
  const userName=localStorage.getItem('userName');
  if(role){aplicarPermissoes(role,userName);inicializarApp();if(role==='entregador')solicitarWakeLock();}
  else{document.getElementById('loginScreen').classList.remove('hidden');document.getElementById('appBody').classList.add('hidden');}
}
function inicializarApp(){
  const hoje=new Date();const d=hoje.getFullYear()+'-'+String(hoje.getMonth()+1).padStart(2,'0')+'-'+String(hoje.getDate()).padStart(2,'0');
  const elInicio=document.getElementById('dataInicio');const elFim=document.getElementById('dataFim');
  if(elInicio)elInicio.value=d;if(elFim)elFim.value=d;
  renderizarTabelaPorData();atualizarDatalist();configurarEventos();
  if(!window._escutaIniciada){iniciarEscutaTempoReal();window._escutaIniciada=true;}
}
async function solicitarWakeLock(){try{await navigator.wakeLock.request('screen');}catch(e){}}

// ========== TEAM MANAGEMENT ==========
function escutarEquipe(){
  onValue(ref(remoteDb,'equipe_entregadores'),snapshot=>{
    const data=snapshot.val();equipeEntregadores=[];
    if(data)Object.keys(data).forEach(key=>equipeEntregadores.push({id:key,nome:data[key].nome}));
    localStorage.setItem('cache_equipe',JSON.stringify(equipeEntregadores));
    renderizarEquipe(equipeEntregadores);
    if(typeof renderizarTabelaPorData==='function')renderizarTabelaPorData();
  });
}
function renderizarEquipe(equipe){
  const loginList=document.getElementById('delivererLoginList');
  if(loginList){
    loginList.innerHTML='';
    if(equipe.length===0)loginList.innerHTML='<p style="font-size:12px;color:#ff7675">Nenhum entregador cadastrado.</p>';
    else equipe.forEach(e=>{const b=document.createElement('button');b.className='btn-role btn-entregador';b.textContent=e.nome;b.onclick=()=>efetuarLoginEntregador(e.nome);loginList.appendChild(b);});
  }
  const teamList=document.getElementById('teamList');
  if(teamList){
    teamList.innerHTML='';
    equipe.forEach(e=>{
      const row=document.createElement('div');row.style.cssText='display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.05);padding:8px 12px;border-radius:8px;margin-bottom:5px;';
      const sp=document.createElement('span');sp.style.cssText='font-weight:600;font-size:14px;';sp.textContent=e.nome;
      const del=document.createElement('button');del.style.cssText='background:none;border:none;cursor:pointer;font-size:16px;';del.textContent='🗑️';del.onclick=()=>removerEntregador(e.id);
      row.appendChild(sp);row.appendChild(del);teamList.appendChild(row);
    });
  }
  const sel=document.getElementById('entregador');
  if(sel){
    sel.innerHTML='';
    const lista=equipe.length>0?equipe:JSON.parse(localStorage.getItem('cache_equipe')||'[]');
    lista.forEach(e=>{const o=document.createElement('option');o.value=e.nome;o.textContent=e.nome;sel.appendChild(o);});
  }
  const escalaList=document.getElementById('delivererEscalaList');
  if(escalaList){
    escalaList.innerHTML='';
    equipe.forEach(e=>{const b=document.createElement('button');b.className='btn-role btn-entregador';b.textContent=e.nome;b.onclick=()=>enviarCargaHoraria(e.nome);escalaList.appendChild(b);});
  }
  const retroSel=document.getElementById('retroEntregador');
  if(retroSel){
    retroSel.innerHTML='<option value="">Selecione...</option>';
    const lista=equipe.length>0?equipe:JSON.parse(localStorage.getItem('cache_equipe')||'[]');
    lista.forEach(e=>{const o=document.createElement('option');o.value=e.nome;o.textContent=e.nome;retroSel.appendChild(o);});
  }
}
function adicionarEntregador(){const input=document.getElementById('newDelivererName');const nome=input.value.trim().toUpperCase();if(!nome)return;push(ref(remoteDb,'equipe_entregadores'),{nome}).then(()=>input.value='');}
function removerEntregador(id){if(confirm("Remover este entregador?"))remove(ref(remoteDb,'equipe_entregadores/'+id));}
function enviarCargaHoraria(nome){
  const resultado=document.getElementById('resultado');
  if(resultado&&resultado.innerText){
    push(ref(remoteDb,'pedidos_realtime'),{cliente:'CARGA HORARIA',entregador:nome,data:new Date().toLocaleString('pt-BR'),endereco:resultado.innerText,statusEntrega:'Pendente',timestamp:Date.now()}).then(()=>{alert('Carga enviada para '+nome+'!');document.getElementById('modalEscala').style.display='none';});
  }
}

// ========== BLACKLIST ==========
function toggleBlacklist(){
  const telInput=document.getElementById('telefone');const telRaw=telInput.value;const telLimpo=telRaw.replace(/\D/g,'');
  if(telLimpo.length<8){alert("Digite um telefone válido.");return;}
  const isBL=clientesBlacklist&&clientesBlacklist[telLimpo];const novoStatus=!isBL;
  mostrarMensagemSucesso(novoStatus?"Número adicionado ao BlackList! 🚫":"Número removido da BlackList! ✅");
  const clientesRef=ref(remoteDb,'clientes');
  get(clientesRef).then(snapshot=>{
    const data=snapshot.val();let clientKey=null;
    if(data)clientKey=Object.keys(data).find(key=>{(data[key].tel||data[key].telefone||'').replace(/\D/g,'')===telLimpo;});
    const upd={tel:telRaw,blacklist:novoStatus,updatedAt:Date.now()};
    if(clientKey)update(ref(remoteDb,'clientes/'+clientKey),upd).then(()=>verificarClientePorHistorico());
    else push(clientesRef,upd).then(()=>verificarClientePorHistorico());
  });
}
function verificarClientePorHistorico(){
  const telInput=document.getElementById('telefone');const telRaw=telInput?telInput.value:'';const telLimpo=telRaw.replace(/\D/g,'');
  const btnBL=document.getElementById('btnBlacklist');
  if(telLimpo.length<8){if(btnBL)btnBL.style.display='none';return;}
  if(btnBL){
    btnBL.style.display='inline-flex';
    const isBL=clientesBlacklist&&clientesBlacklist[telLimpo];
    if(isBL){btnBL.style.background='#ff1744';btnBL.style.color='white';btnBL.style.borderColor='#ff1744';}
    else{btnBL.style.background='#1a1a1a';btnBL.style.color='#ff1744';btnBL.style.borderColor='#ff1744';}
  }
}

// ========== REALTIME LISTENER ==========
function iniciarEscutaTempoReal(){
  onValue(query(ref(remoteDb,'pedidos_realtime'), limitToLast(500)),snapshot=>{
    const data=snapshot.val();todosPedidosFirebase=[];
    if(data)Object.keys(data).forEach(key=>todosPedidosFirebase.push({id:key,...data[key]}));
    const configNaEntrega=localStorage.getItem('printConfig_naEntrega')==='true';
    if(configNaEntrega){
      const isPrimeiraCarga=!window.realtimeCargaInicialCompleta;
      todosPedidosFirebase.forEach(p=>{
        const status=(p.statusEntrega||'').trim().toUpperCase();
        if(status==='CONCLUÍDA'&&!window.pedidosJaImpressosNaEntrega.has(p.id)){
          window.pedidosJaImpressosNaEntrega.add(p.id);
          if(!isPrimeiraCarga){
            const pagsSalvos=JSON.parse(localStorage.getItem('printConfig_pagamentos')||'[]');
            if(pagsSalvos.includes(p.pagamento))imprimirRecibo(p,p.qtd>1?p.qtd+'x '+p.produto:p.produto,true);
          }
        }
      });
      window.realtimeCargaInicialCompleta=true;
    }
    const role=localStorage.getItem('userRole');
    if(role!=='entregador'){
      const concluidos=todosPedidosFirebase.filter(p=>(p.statusEntrega||'').trim().toUpperCase()==='CONCLUÍDA').length;
      const ultima=parseInt(localStorage.getItem('admin_ultimaContagemConcluidos')||"-1");
      if(ultima!==-1&&concluidos>ultima){
        tocarAlertaConclusao();
        const ultimoConcluido=todosPedidosFirebase.filter(p=>(p.statusEntrega||'').trim().toUpperCase()==='CONCLUÍDA').sort((a,b)=>new Date(b.tempo_concluido||0)-new Date(a.tempo_concluido||0))[0];
        const msg=ultimoConcluido?'Entregador: '+(ultimoConcluido.entregador||'Desconhecido'):'Um novo pedido foi finalizado.';
        mostrarNotificacaoConclusao(msg);
      }
      localStorage.setItem('admin_ultimaContagemConcluidos',concluidos);
    }
    renderizarTabelaPorData();atualizarDatalist();
  });
  escutarBina();escutarEquipe();
  onValue(ref(remoteDb,'clientes'),snapshot=>{
    const data=snapshot.val();clientesBlacklist={};clientesCadastradosGlobais=data||{};
    if(data)Object.values(data).forEach(c=>{if(c.blacklist){const t=(c.tel||'').replace(/\D/g,'');if(t)clientesBlacklist[t]=true;}});
    if(typeof atualizarDatalist==='function')atualizarDatalist();
  });
}
function escutarBina(){
  onValue(ref(remoteDb,'bina_live'),snapshot=>{
    const data=snapshot.val();
    if(data&&data.numero){
      const agora=Date.now();if(agora-data.timestamp>30000)return;
      const inputTel=document.getElementById('telefone');if(inputTel){inputTel.value=data.numero;mascaraTelefone(inputTel);mostrarNotificacaoConclusao('📞 Chamada Recebida: '+data.numero);}
    }
  });
}
function tocarAlertaConclusao(){
  try{const a=new(window.AudioContext||window.webkitAudioContext)();const o=a.createOscillator();const g=a.createGain();o.type='sine';o.frequency.setValueAtTime(523.25,a.currentTime);o.frequency.exponentialRampToValueAtTime(783.99,a.currentTime+0.3);g.gain.setValueAtTime(0.1,a.currentTime);g.gain.exponentialRampToValueAtTime(0.01,a.currentTime+0.5);o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+0.5);}catch(e){}
}
function mostrarNotificacaoConclusao(msg){
  const toast=document.getElementById('notificacaoConcluido');const toastMsg=document.getElementById('toastMsg');
  if(toast&&toastMsg){toastMsg.innerText=msg;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),5000);}
}
function tocarAlertaSonoro(){
  try{const a=new(window.AudioContext||window.webkitAudioContext)();const o=a.createOscillator();const g=a.createGain();o.type='square';o.frequency.setValueAtTime(880,a.currentTime);g.gain.setValueAtTime(0.1,a.currentTime);g.gain.exponentialRampToValueAtTime(0.01,a.currentTime+0.5);o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+0.5);}catch(e){}
  if('Notification'in window&&Notification.permission==='granted')new Notification('🔔 NOVO PEDIDO!',{body:'Você tem um novo pedido pendente!',icon:'logo.png'});
}

// ========== TABLE RENDERING ==========
function renderizarTabelaPorData(){
  const corpoTabela=document.getElementById('corpoTabela');
  const cabecalho=document.querySelector('#tabelaPedidos thead tr');
  const role=localStorage.getItem('userRole');const userName=localStorage.getItem('userName');
  if(role==='entregador'&&cabecalho)cabecalho.innerHTML='<th>Cliente</th><th>Produto</th><th>Endereço</th><th>Valor</th><th>Pagamento</th><th>Status Entrega</th><th class="no-excel">Ações</th>';
  else if(cabecalho)cabecalho.innerHTML='<th>Data/Hora</th><th>Cliente</th><th>Telefone</th><th>Canal</th><th>Produto</th><th>🛵 Entregador</th><th>Endereço</th><th>Valor</th><th>Duração</th><th>Status Ret.</th><th>Status Entrega</th><th>Pagamento</th><th class="no-excel">Ações</th>';
  corpoTabela.innerHTML='';
  const busca=(document.getElementById('inputBusca').value||'').toUpperCase();
  const dataInicio=new Date(document.getElementById('dataInicio').value+'T00:00:00');
  const dataFim=new Date(document.getElementById('dataFim').value+'T23:59:59');
  const processarData=str=>{
    if(!str)return new Date(0);
    try{const partes=str.match(/(\d+)/g);if(!partes||partes.length<3)return new Date(0);return new Date(partes[2]+'-'+partes[1]+'-'+partes[0]+'T'+(partes[3]||'00')+':'+(partes[4]||'00')+':'+(partes[5]||'00'));}catch(e){return new Date(0);}
  };
  const filtrados=todosPedidosFirebase.filter(p=>{
    const dataPedido=processarData(p.data);
    const bateData=dataPedido>=dataInicio&&dataPedido<=dataFim;
    if(role==='entregador'){
      const logado=(localStorage.getItem('userName')||'').trim().toUpperCase();
      if((p.entregador||'').trim().toUpperCase()!==logado)return false;
      if(!bateData)return false;
      const statusFiltro=document.getElementById('filtroStatusEntregador')?.value||'pendente';
      const statusNorm=(p.statusEntrega||'Pendente').trim().toUpperCase();
      const isPendente=statusNorm==='PENDENTE'||statusNorm==='EM ROTA'||statusNorm==='INICIADO'||statusNorm==='PRIORIZAR';
      if(statusFiltro==='pendente'&&!isPendente)return false;
      if(statusFiltro==='concluido'&&isPendente)return false;
      if(busca){const txt=[p.cliente,p.telefone,p.endereco,p.canalVenda,p.entregador,p.produto,p.pagamento].join(' ').toUpperCase();return txt.includes(busca);}
      return true;
    }
    if(!bateData)return false;
    if(!busca)return true;
    const txt=[p.cliente,p.telefone,p.endereco,p.canalVenda,p.entregador,p.produto,p.pagamento].join(' ').toUpperCase();
    return txt.includes(busca);
  });
  pedidosFiltradosGlobal=filtrados;
  const ordenados=filtrados.sort((a,b)=>{
    const aP=(a.statusEntrega||'').trim().toUpperCase()==='PRIORIZAR'?1:0;
    const bP=(b.statusEntrega||'').trim().toUpperCase()==='PRIORIZAR'?1:0;
    if(aP!==bP)return bP-aP;
    return processarData(b.data)-processarData(a.data);
  });
  contagemEnderecos={};
  ordenados.forEach(p=>{const end=(p.endereco||'').trim().toUpperCase();if(end.length>3)contagemEnderecos[end]=(contagemEnderecos[end]||0)+1;});
  const pendentes=ordenados.filter(p=>{const s=(p.statusEntrega||'Pendente').trim().toUpperCase();return s==='PENDENTE'||s==='EM ROTA'||s==='INICIADO'||s==='PRIORIZAR';});
  const finalizados=ordenados.filter(p=>{const s=(p.statusEntrega||'Pendente').trim().toUpperCase();return s!=='PENDENTE'&&s!=='EM ROTA'&&s!=='INICIADO'&&s!=='PRIORIZAR';});
  if(role==='entregador'){
    const contagem=pendentes.length;const ultimaSalva=localStorage.getItem('ultimaContagemPendentes');
    if(ultimaSalva===null){if(contagem>0){tocarAlertaSonoro();mostrarMensagemSucesso("🔔 VOCÊ TEM PEDIDOS PENDENTES!");}localStorage.setItem('ultimaContagemPendentes',contagem);}
    else{const ultima=parseInt(ultimaSalva);if(contagem>ultima){tocarAlertaSonoro();mostrarMensagemSucesso("🔔 NOVO PEDIDO!");}localStorage.setItem('ultimaContagemPendentes',contagem);}
  }
  const criarCabecalhoGrupo=texto=>{
    const tr=document.createElement('tr');tr.style.background='#f1f2f6';tr.style.fontWeight='bold';tr.style.textAlign='center';
    const td=document.createElement('td');td.colSpan=role==='entregador'?7:13;td.style.padding='12px';td.textContent=texto;tr.appendChild(td);return tr;
  };
  if(pendentes.length>0){corpoTabela.appendChild(criarCabecalhoGrupo('🚚 PEDIDOS PENDENTES'));pendentes.forEach(p=>corpoTabela.appendChild(criarLinhaTabela(p)));}
  if(finalizados.length>0){corpoTabela.appendChild(criarCabecalhoGrupo('✅ PEDIDOS FINALIZADOS'));finalizados.forEach(p=>corpoTabela.appendChild(criarLinhaTabela(p)));}
  let vGas=0,iGas=0,vAgua=0,iAgua=0;
  ordenados.forEach(p=>{const prod=(p.produto||'').toLowerCase();const q=parseInt(p.qtd)||0;if(prod.includes('água')||prod.includes('agua')){vAgua++;iAgua+=q;}else{vGas++;iGas+=q;}});
  const elTotal=document.getElementById('totalPedidos');if(elTotal)elTotal.innerText=iGas+iAgua;
}

function criarLinhaTabela(p){
  const infoStatus=calcularStatusRetencao(p.data,p.duracaoGas);
  const tr=document.createElement('tr');
  if(infoStatus.classe)tr.classList.add(infoStatus.classe);
  if(p.conferido&&p.notaFiscal)tr.classList.add('row-conferido-nota-fiscal');
  else if(p.conferido)tr.classList.add('row-conferido');
  else if(p.notaFiscal)tr.classList.add('row-nota-fiscal');
  const endNorm=(p.endereco||'').trim().toUpperCase();
  if(endNorm.length>3&&contagemEnderecos[endNorm]>1)tr.classList.add('row-endereco-duplicado');
  const hTd=(text,isHtml=false)=>{const td=document.createElement('td');if(isHtml)td.innerHTML=text;else td.textContent=text;return td;};
  const criarTdPagamentoEditavel=()=>{
    const td=document.createElement('td');const wrap=document.createElement('div');wrap.style.cssText='display:flex;align-items:center;gap:5px;flex-wrap:wrap';
    if(p.foto_comprovante){const b=document.createElement('span');b.textContent='📸';b.style.cssText='background:#6c5ce7;color:white;padding:2px 6px;border-radius:4px;font-size:10px;margin-right:5px;cursor:pointer';b.onclick=e=>{e.stopPropagation();abrirFotoGrande(p.foto_comprovante);};wrap.appendChild(b);}
    const txt=document.createElement('span');txt.textContent=p.pagamento||'-';txt.style.cursor='pointer';txt.title='Clique para alterar';wrap.appendChild(txt);
    const editor=document.createElement('div');editor.style.display='none';editor.style.alignItems='center';editor.style.gap='5px';
    const sel=document.createElement('select');sel.style.cssText='padding:4px 6px;border:1px solid #ccc;border-radius:6px';
    Array.from(document.querySelectorAll('#pagamento option')).map(o=>o.value).filter(Boolean).forEach(op=>{const o=document.createElement('option');o.value=op;o.textContent=op;sel.appendChild(o);});
    sel.value=p.pagamento||'DINHEIRO';
    const btn=document.createElement('button');btn.textContent='Salvar';btn.style.cssText='padding:4px 8px;min-width:unset;width:auto;border-radius:6px;border:none;cursor:pointer;background:#55efc4;color:#008c72;font-size:10px';
    editor.appendChild(sel);editor.appendChild(btn);wrap.appendChild(editor);td.appendChild(wrap);
    txt.onclick=e=>{e.stopPropagation();txt.style.display='none';editor.style.display='inline-flex';sel.focus();};
    btn.onclick=e=>{e.stopPropagation();const novo=sel.value;if(!novo||novo===p.pagamento){txt.style.display='';editor.style.display='none';return;}
      btn.disabled=true;update(ref(remoteDb,'pedidos_realtime/'+p.id),{pagamento:novo,rateioPagamento:null}).then(()=>{p.pagamento=novo;txt.textContent=novo;mostrarMensagemSucesso('Pagamento atualizado! 💳');}).catch(()=>alert('Erro ao atualizar pagamento.')).finally(()=>{btn.disabled=false;txt.style.display='';editor.style.display='none';});};
    return td;
  };
  const criarTdEntregadorEditavel=()=>{
    const td=document.createElement('td');td.style.fontWeight='bold';const wrap=document.createElement('div');wrap.style.cssText='display:flex;align-items:center;gap:5px;flex-wrap:wrap';
    const txt=document.createElement('span');txt.textContent=p.entregador||'-';txt.style.cursor='pointer';txt.title='Clique para alterar';wrap.appendChild(txt);
    const editor=document.createElement('div');editor.style.display='none';editor.style.alignItems='center';editor.style.gap='5px';
    const sel=document.createElement('select');sel.style.cssText='padding:4px 6px;border:1px solid #ccc;border-radius:6px;font-size:12px';
    const lista=equipeEntregadores.length>0?equipeEntregadores:JSON.parse(localStorage.getItem('cache_equipe')||'[]');
    lista.forEach(e=>{const o=document.createElement('option');o.value=e.nome;o.textContent=e.nome;sel.appendChild(o);});
    if(sel.options.length===0&&p.entregador){const o=document.createElement('option');o.value=p.entregador;o.textContent=p.entregador;sel.appendChild(o);}
    sel.value=p.entregador||'';
    const btnSalvar=document.createElement('button');btnSalvar.textContent='Salvar';btnSalvar.style.cssText='padding:4px 8px;min-width:unset;width:auto;border-radius:6px;border:none;cursor:pointer;background:#55efc4;color:#008c72;font-size:10px';
    editor.appendChild(sel);editor.appendChild(btnSalvar);wrap.appendChild(editor);td.appendChild(wrap);
    txt.onclick=e=>{e.stopPropagation();txt.style.display='none';editor.style.display='inline-flex';sel.focus();};
    btnSalvar.onclick=e=>{e.stopPropagation();const novo=sel.value;if(!novo||novo===p.entregador){txt.style.display='';editor.style.display='none';return;}
      btnSalvar.disabled=true;update(ref(remoteDb,'pedidos_realtime/'+p.id),{entregador:novo}).then(()=>{p.entregador=novo;txt.textContent=novo;mostrarMensagemSucesso('Entregador atualizado! 🛵');}).catch(()=>alert('Erro ao atualizar entregador.')).finally(()=>{btnSalvar.disabled=false;txt.style.display='';editor.style.display='none';});};
    return td;
  };
  const criarTdValorEditavel=()=>{
    const td=document.createElement('td');const wrap=document.createElement('div');wrap.style.cssText='display:flex;align-items:center;gap:5px;flex-wrap:wrap';
    const txt=document.createElement('span');txt.textContent='R$ '+p.valor;txt.style.cursor='pointer';txt.title='Clique para alterar';wrap.appendChild(txt);
    const editor=document.createElement('div');editor.style.display='none';editor.style.alignItems='center';editor.style.gap='5px';
    const inp=document.createElement('input');inp.type='text';inp.value=p.valor;inp.style.cssText='width:70px;padding:4px 6px;border:1px solid #ccc;border-radius:6px;font-size:12px';
    const btn=document.createElement('button');btn.textContent='Salvar';btn.style.cssText='padding:4px 8px;min-width:unset;width:auto;border-radius:6px;border:none;cursor:pointer;background:#55efc4;color:#008c72;font-size:10px';
    editor.appendChild(inp);editor.appendChild(btn);wrap.appendChild(editor);td.appendChild(wrap);
    txt.onclick=e=>{e.stopPropagation();txt.style.display='none';editor.style.display='inline-flex';inp.focus();};
    btn.onclick=e=>{e.stopPropagation();const novo=inp.value.trim();if(!novo||novo===p.valor){txt.style.display='';editor.style.display='none';return;}
      btn.disabled=true;update(ref(remoteDb,'pedidos_realtime/'+p.id),{valor:novo}).then(()=>{p.valor=novo;txt.textContent='R$ '+novo;mostrarMensagemSucesso('Valor atualizado! 💵');}).catch(()=>alert('Erro ao atualizar valor.')).finally(()=>{btn.disabled=false;txt.style.display='';editor.style.display='none';});};
    return td;
  };
  const criarTdCanalEditavel=()=>{
    const td=document.createElement('td');const wrap=document.createElement('div');wrap.style.cssText='display:flex;align-items:center;gap:5px;flex-wrap:wrap';
    const txt=document.createElement('span');txt.textContent=p.canalVenda||'-';txt.style.cursor='pointer';wrap.appendChild(txt);
    const editor=document.createElement('div');editor.style.display='none';editor.style.alignItems='center';editor.style.gap='5px';
    const sel=document.createElement('select');sel.style.cssText='padding:4px 6px;border:1px solid #ccc;border-radius:6px;font-size:12px';
    Array.from(document.querySelectorAll('#canalVenda option')).map(o=>o.value).filter(Boolean).forEach(op=>{const o=document.createElement('option');o.value=op;o.textContent=op;sel.appendChild(o);});
    sel.value=p.canalVenda||'DISK ENTREGA';
    const btn=document.createElement('button');btn.textContent='Salvar';btn.style.cssText='padding:4px 8px;min-width:unset;width:auto;border-radius:6px;border:none;cursor:pointer;background:#55efc4;color:#008c72;font-size:10px';
    editor.appendChild(sel);editor.appendChild(btn);wrap.appendChild(editor);td.appendChild(wrap);
    txt.onclick=e=>{e.stopPropagation();txt.style.display='none';editor.style.display='inline-flex';sel.focus();};
    btn.onclick=e=>{e.stopPropagation();const novo=sel.value;if(!novo||novo===p.canalVenda){txt.style.display='';editor.style.display='none';return;}
      btn.disabled=true;update(ref(remoteDb,'pedidos_realtime/'+p.id),{canalVenda:novo}).then(()=>{p.canalVenda=novo;txt.textContent=novo;mostrarMensagemSucesso('Canal atualizado! 🛒');}).catch(()=>alert('Erro ao atualizar canal.')).finally(()=>{btn.disabled=false;txt.style.display='';editor.style.display='none';});};
    return td;
  };
  const criarTdProdutoEditavel=()=>{
    const td=document.createElement('td');const wrap=document.createElement('div');wrap.style.cssText='display:flex;align-items:center;gap:5px;flex-wrap:wrap';
    const txt=document.createElement('span');txt.textContent=p.produto||'-';txt.style.cursor='pointer';wrap.appendChild(txt);
    const editor=document.createElement('div');editor.style.display='none';editor.style.alignItems='center';editor.style.gap='5px';
    const sel=document.createElement('select');sel.style.cssText='padding:4px 6px;border:1px solid #ccc;border-radius:6px;font-size:12px';
    Array.from(document.querySelectorAll('#produto option')).forEach(o=>{const op=document.createElement('option');op.value=o.value;op.textContent=o.textContent;sel.appendChild(op);});
    if(p.produto&&!Array.from(sel.options).some(o=>o.value===p.produto)){const o=document.createElement('option');o.value=p.produto;o.textContent=p.produto;sel.appendChild(o);}
    sel.value=p.produto||'Gás 13kg';
    const btn=document.createElement('button');btn.textContent='Salvar';btn.style.cssText='padding:4px 8px;min-width:unset;width:auto;border-radius:6px;border:none;cursor:pointer;background:#55efc4;color:#008c72;font-size:10px';
    editor.appendChild(sel);editor.appendChild(btn);wrap.appendChild(editor);td.appendChild(wrap);
    txt.onclick=e=>{e.stopPropagation();txt.style.display='none';editor.style.display='inline-flex';sel.focus();};
    btn.onclick=e=>{e.stopPropagation();const novo=sel.value;if(!novo||novo===p.produto){txt.style.display='';editor.style.display='none';return;}
      btn.disabled=true;update(ref(remoteDb,'pedidos_realtime/'+p.id),{produto:novo}).then(()=>{p.produto=novo;txt.textContent=novo;mostrarMensagemSucesso('Produto atualizado! 📦');}).catch(()=>alert('Erro ao atualizar produto.')).finally(()=>{btn.disabled=false;txt.style.display='';editor.style.display='none';});};
    return td;
  };
  const criarTdEnderecoEditavel=(reduz=false)=>{
    const td=document.createElement('td');const wrap=document.createElement('div');wrap.style.cssText='display:flex;align-items:center;gap:5px;flex-wrap:wrap';
    const txt=document.createElement('span');const atualizarDisplay=val=>{txt.textContent=reduz?(val?val.substring(0,30)+(val.length>30?'...':''):'-'):(val||'-');};
    atualizarDisplay(p.endereco);txt.style.cursor='pointer';wrap.appendChild(txt);
    const editor=document.createElement('div');editor.style.display='none';editor.style.alignItems='center';editor.style.gap='5px';editor.style.width='100%';
    const inp=document.createElement('input');inp.type='text';inp.value=p.endereco||'';inp.style.cssText='padding:4px 6px;border:1px solid #ccc;border-radius:6px;font-size:12px;flex:1;min-width:120px';
    const btn=document.createElement('button');btn.textContent='Salvar';btn.style.cssText='padding:4px 8px;min-width:unset;width:auto;border-radius:6px;border:none;cursor:pointer;background:#55efc4;color:#008c72;font-size:10px';
    editor.appendChild(inp);editor.appendChild(btn);wrap.appendChild(editor);td.appendChild(wrap);
    txt.onclick=e=>{e.stopPropagation();txt.style.display='none';editor.style.display='inline-flex';inp.focus();};
    inp.onkeyup=e=>{if(e.key==='Enter')btn.click();};
    btn.onclick=e=>{e.stopPropagation();const novo=inp.value.trim();if(!novo||novo===p.endereco){txt.style.display='';editor.style.display='none';return;}
      btn.disabled=true;update(ref(remoteDb,'pedidos_realtime/'+p.id),{endereco:novo}).then(()=>{p.endereco=novo;atualizarDisplay(novo);mostrarMensagemSucesso('Endereço atualizado! 📍');}).catch(()=>alert('Erro ao atualizar endereço.')).finally(()=>{btn.disabled=false;txt.style.display='';editor.style.display='none';});};
    return td;
  };
  const isEntregador=localStorage.getItem('userRole')==='entregador';
  if(isEntregador){
    tr.appendChild(hTd(p.cliente));
    tr.appendChild(criarTdProdutoEditavel());tr.appendChild(criarTdEnderecoEditavel(false));
    tr.appendChild(criarTdValorEditavel());tr.appendChild(criarTdPagamentoEditavel());
    const st=(p.statusEntrega||'Pendente');const stTxt=st==='Em Rota'?'INICIADO':(st==='Priorizar'?'PRIORIZAR':st);const stCls=st.toLowerCase().replace(/\s+/g,'-');
    tr.appendChild(hTd('<span class="badge-status status-'+stCls+'">'+stTxt+'</span>',true));
  } else {
    tr.appendChild(hTd((p.numSeq?'<span style="background:#2d3436;color:white;padding:1px 5px;border-radius:3px;font-size:11px;margin-right:4px">'+p.numSeq+'</span>':'')+(p.data||''),true));
    tr.appendChild(hTd(p.cliente||''));tr.appendChild(hTd(p.telefone||''));
    tr.appendChild(criarTdCanalEditavel());tr.appendChild(criarTdProdutoEditavel());
    tr.appendChild(criarTdEntregadorEditavel());tr.appendChild(criarTdEnderecoEditavel(true));
    tr.appendChild(criarTdValorEditavel());
    tr.appendChild(hTd(p.duracaoGas?p.duracaoGas+' d':'-'));
    tr.appendChild(hTd(infoStatus.texto));
    const st=(p.statusEntrega||'Pendente');const stTxt=st==='Em Rota'?'INICIADO':(st==='Priorizar'?'PRIORIZAR':st);const stCls=st.toLowerCase().replace(/\s+/g,'-');
    tr.appendChild(hTd('<span class="badge-status status-'+stCls+'">'+stTxt+'</span>',true));
    tr.appendChild(criarTdPagamentoEditavel());
  }
  const tdAcoes=document.createElement('td');tdAcoes.className='col-acoes';
  const criarBtn=(emoji,title,cls,onClick)=>{const b=document.createElement('button');b.textContent=emoji;b.title=title;b.className=cls;b.onclick=e=>{e.stopPropagation();onClick(p);};return b;};
  if(isEntregador){
    const b=document.createElement('button');b.innerHTML='📋 Ver Detalhes';b.className='btn-primary';b.style.cssText='width:auto;min-width:unset;padding:6px 12px;font-size:12px';b.onclick=()=>mostrarDetalhesPedido(p);tdAcoes.appendChild(b);
  }else{
    tdAcoes.appendChild(criarBtn('🛢️','Lembrete Recompra','btn-recompra',()=>copiarMensagemRecompra(p)));
    tdAcoes.appendChild(criarBtn('💬','Copiar Mensagem Cliente','btn-re-copiar',()=>copiarTextoParaClipboard(gerarMensagemCliente(p))));
    tdAcoes.appendChild(criarBtn('🛵','Copiar Mensagem Entregador','btn-re-copiar',()=>copiarTextoParaClipboard(gerarMensagemEntregador(p))));
    const status=(p.statusEntrega||'Pendente').trim().toUpperCase();
    if(status==='CONCLUÍDA'){
      tdAcoes.appendChild(criarBtn('✓','Conferir Pedido','btn-conferir'+(p.conferido?' active':''),()=>marcarConferido(p,!!p.conferido)));
      tdAcoes.appendChild(criarBtn('🧾','Nota Fiscal Emitida','btn-nota-fiscal'+(p.notaFiscal?' active':''),()=>marcarNotaFiscal(p,!!p.notaFiscal)));
    }
    if(status!=='CONCLUÍDA'&&status!=='CANCELADA'){
      tdAcoes.appendChild(criarBtn('🏁','Concluir Entrega','btn-editar',()=>concluirEntregaAdmin(p)));
      tdAcoes.appendChild(criarBtn('🚀','Priorizar Entrega','btn-primary',()=>priorizarEntregaAdmin(p)));
      tdAcoes.appendChild(criarBtn('🚫','Cancelar Pedido','btn-excluir',()=>cancelarPedidoAdmin(p)));
    }
    if(status!=='CANCELADA'){
      tdAcoes.appendChild(criarBtn('🖨️','Reimprimir','btn-re-copiar',()=>{const dp=p.qtd>1?p.qtd+'x '+p.produto:p.produto;imprimirRecibo(p,dp,status==='CONCLUÍDA',true);}));
    }
    tdAcoes.appendChild(criarBtn('✏️','Editar','btn-editar',()=>carregarParaEdicao(p)));
    tdAcoes.appendChild(criarBtn('⏱️','Ver Tempos','btn-re-copiar',()=>mostrarModalTempos(p)));
    tdAcoes.appendChild(criarBtn('❌','Excluir','btn-excluir',()=>excluirPedido(p.id)));
  }
  tr.appendChild(tdAcoes);
  return tr;
}

function calcularStatusRetencao(dataCompraStr,duracao){
  if(!duracao||duracao<=0)return{texto:"-",classe:""};
  try{const[dataPart]=dataCompraStr.split(/[\s,]+/);const[d,m,y]=dataPart.split('/');const dataCompra=new Date(y+'-'+m+'-'+d);const hoje=new Date();hoje.setHours(0,0,0,0);const diff=Math.abs(hoje-dataCompra);const passados=Math.ceil(diff/(86400000));const restantes=duracao-passados;if(restantes<=0)return{texto:"⚠️",classe:"status-vencido"};if(restantes<=3)return{texto:"⏳",classe:"status-vencendo"};return{texto:"✅",classe:""};}catch(e){return{texto:"?",classe:""};}
}

// ========== CRUD ==========
function gerarMensagemEntregador(p){
  const dp=p.qtd>1?p.qtd+'x '+p.produto:p.produto;
  return 'ENTREGAR PARA - '+p.cliente+', '+p.endereco+'\n\n🛵 Entregador: '+p.entregador+'\n-------------------------------\n👤 Cliente: '+p.cliente+'\n🛒 Canal: '+p.canalVenda+'\n📞 Tel: '+p.telefone+'\n🚚 Endereço: '+p.endereco+'\n📦 Produto: '+dp+'\n📝 Info: '+(p.informacoes||'')+'\n💳 Pagamento: '+p.pagamento+'\n💵 Valor: R$ '+p.valor+'\n-------------------------------\n\n📍 Waze: https://waze.com/ul?q='+encodeURIComponent(p.endereco||'')+'\n📍 Google Maps: https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p.endereco||'');
}
function gerarMensagemCliente(p){
  const dp=p.qtd>1?p.qtd+'x '+p.produto:p.produto;
  return 'Olá, '+p.cliente+'! 👋\n\nSeu pedido de gás ou água, via '+p.canalVenda+', está a caminho!\n\n🛵 Entregador: '+p.entregador+'\n-------------------------------\n👤 Cliente: '+p.cliente+'\n📞 Tel: '+p.telefone+'\n🚚 Endereço: '+p.endereco+'\n📦 Produto: '+dp+'\n📝 Info: '+(p.informacoes||'')+'\n💳 Pagamento: '+p.pagamento+'\n💵 Valor: R$ '+p.valor+'\n\nContato da revenda: 31-98255 7807\n-------------------------------\n\nO tempo da entrega aproximado de 35 minutos.\n\nCanoas gás agradece sua confiança e preferência!';
}
function abrirModalPromocao(dados,displayProd,isPortaria,isPesquisa,textoEntregador,textoCliente){
  const modal=document.getElementById('modalPromo');if(!modal)return;
  const savedTexto=localStorage.getItem('promoDefault_texto');const savedValor=localStorage.getItem('promoDefault_valor');
  document.getElementById('promoTexto').value=savedTexto!==null?savedTexto:'Ganhe um desconto pedindo direto neste Whatsapp. Informe o Cupon: DIRETO';
  document.getElementById('promoValor').value=savedValor!==null?savedValor:'5';
  document.getElementById('btnConfirmarPromo').onclick=()=>{
    const promoTexto=document.getElementById('promoTexto').value.trim();const promoValor=document.getElementById('promoValor').value.trim();
    localStorage.setItem('promoDefault_texto',promoTexto);localStorage.setItem('promoDefault_valor',promoValor);
    let textoComPromo=textoCliente;if(promoTexto||promoValor){textoComPromo+='\n\n🎁 PROMOÇÃO ESPECIAL PARA VOCÊ:';if(promoTexto)textoComPromo+='\n'+promoTexto;if(promoValor)textoComPromo+='\nValor da Promoção: R$ '+promoValor;}
    dados.msgGerada=textoComPromo;modal.style.display='none';salvarEFinalizarPedido(dados,displayProd,isPortaria,isPesquisa,textoEntregador,textoComPromo);
  };
  document.getElementById('btnPularPromo').onclick=()=>{modal.style.display='none';dados.msgGerada=textoCliente;salvarEFinalizarPedido(dados,displayProd,isPortaria,isPesquisa,textoEntregador,textoCliente);};
  modal.style.display='block';
}
function salvarEFinalizarPedido(dados,displayProd,isPortaria,isPesquisa,textoEntregador,textoCliente){
  push(ref(remoteDb,'pedidos_realtime'),dados);
  const setTxt=(id,txt)=>{const el=document.getElementById(id);if(el){el.innerText=txt;el.style.display=isPesquisa?'none':'block';}};
  setTxt('resultado', window.gerarMensagemFichaEntregaUI ? window.gerarMensagemFichaEntregaUI(dados) : textoEntregador); setTxt('msgCliente',textoCliente);
  document.querySelectorAll('.secao-titulo,.btn-copiar').forEach(el=>{el.style.display=isPesquisa?'none':'block';});
  const btnEscala=document.getElementById('btnEscala');if(btnEscala)btnEscala.style.display=(isPortaria||isPesquisa)?'none':'block';
  if(isPesquisa)mostrarMensagemSucesso("Pesquisa salva! ✅");
  atualizarDatalist();document.getElementById('tab-operacao').scrollIntoView({behavior:'smooth'});
  if(!isPesquisa)imprimirRecibo(dados,displayProd,false,false,true);
}
function gerarPedido(){
  const $=id=>document.getElementById(id).value;
  const nome=$('nome').trim();const endereco=$('endereco').trim();const valor=$('valor').trim();
  if(!nome||!endereco||!valor){alert("Campos obrigatórios: Nome, Endereço e Valor.");return;}
  const canalVenda=$('canalVenda');const isPortaria=canalVenda==='PORTARIA'||canalVenda==='GAS DO POVO PORTARIA';const isPesquisa=canalVenda==='PESQUISA';
  const dados={data:new Date().toLocaleString('pt-BR'),cliente:nome,telefone:$('telefone')||"Não informado",canalVenda,qtd:parseInt($('qtd'))||1,produto:$('produto'),endereco,informacoes:$('informacoes'),entregador:isPesquisa?'PESQUISA':($('entregador')||'').trim().toUpperCase(),pagamento:isPesquisa?'PESQUISA':$('pagamento'),valor,duracaoGas:$('duracaoGas'),statusEntrega:isPesquisa?'PESQUISA':(isPortaria?'Concluída':'Pendente'),numSeq:obterProximoSequencial(),timestamp:Date.now()};
  const telLimpo=(dados.telefone||'').replace(/\D/g,'');
  const comprasConcluidas=todosPedidosFirebase.filter(p=>{const pt=(p.telefone||'').replace(/\D/g,'');return pt===telLimpo&&(p.statusEntrega||'').trim().toUpperCase()==='CONCLUÍDA';}).length;
  dados.badgeStatusRegistro=comprasConcluidas>0?'ANTIGO':'NOVO';
  const displayProd=dados.qtd>1?dados.qtd+'x '+dados.produto:dados.produto;
  const textoEntregador=gerarMensagemEntregador(dados);const textoCliente=gerarMensagemCliente(dados);
  dados.msgGerada=textoCliente;
  const canaisPromo=JSON.parse(localStorage.getItem('promoConfig_canais')||'[]');
  if(canaisPromo.includes(canalVenda))abrirModalPromocao(dados,displayProd,isPortaria,isPesquisa,textoEntregador,textoCliente);
  else salvarEFinalizarPedido(dados,displayProd,isPortaria,isPesquisa,textoEntregador,textoCliente);
}
function excluirPedido(id){
  if(confirm("Tem certeza que deseja excluir este pedido?")){if(typeof id==='string')remove(ref(remoteDb,'pedidos_realtime/'+id));else{}}
}
function concluirEntregaAdmin(p){if(confirm('Concluir entrega para '+p.cliente+'?'))update(ref(remoteDb,'pedidos_realtime/'+p.id),{statusEntrega:'Concluída',tempo_concluido:new Date().toLocaleString('pt-BR')}).then(()=>mostrarMensagemSucesso("Entrega concluída! 🏁"));}
function priorizarEntregaAdmin(p){const isP=(p.statusEntrega||'').trim().toUpperCase()==='PRIORIZAR';update(ref(remoteDb,'pedidos_realtime/'+p.id),{statusEntrega:isP?'Pendente':'Priorizar'}).then(()=>mostrarMensagemSucesso(isP?"Prioridade removida! ✅":"Pedido priorizado! 🚀"));}
function cancelarPedidoAdmin(p){if(confirm("Cancelar pedido de "+p.cliente+"?"))update(ref(remoteDb,'pedidos_realtime/'+p.id),{statusEntrega:'Cancelada',tempo_cancelado:new Date().toLocaleString('pt-BR')}).then(()=>mostrarMensagemSucesso("Pedido cancelado! 🚫"));}
function carregarParaEdicao(p){
  const setVal=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val||'';};
  setVal('nome',p.cliente);setVal('telefone',p.telefone);setVal('endereco',p.endereco);setVal('produto',p.produto);
  setVal('valor',p.valor);setVal('duracaoGas',p.duracaoGas);setVal('pagamento',p.pagamento);
  setVal('canalVenda',p.canalVenda);setVal('entregador',p.entregador);setVal('informacoes',p.informacoes);
  switchTab('operacao');document.getElementById('tab-operacao').scrollIntoView({behavior:'smooth'});
}
function obterProximoSequencial(){
  const hoje=new Date().toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});
  const pedidosHoje=todosPedidosFirebase.filter(p=>{if(!p.data||!p.numSeq)return false;return p.data.split(',')[0].trim()===hoje;});
  let max=0;pedidosHoje.forEach(p=>{const n=parseInt(p.numSeq.replace('#',''),10);if(!isNaN(n)&&n>max)max=n;});
  return '#'+String(max+1).padStart(3,'0');
}

// ========== RATEIO ==========
async function marcarConferido(pedidoOuId,currentStatus){
  const pedido=(pedidoOuId&&typeof pedidoOuId==='object')?pedidoOuId:{id:pedidoOuId};
  const id=pedido.id;const pagamento=String(pedido.pagamento||'').toUpperCase();
  if(pagamento.includes('+')&&!currentStatus){abrirModalRateioPagamento(pedido);return;}
  try{await update(ref(remoteDb,'pedidos_realtime/'+id),{conferido:!currentStatus});}catch(e){alert("Erro ao conferir.");}
}
async function marcarNotaFiscal(pedidoOuId,currentStatus){
  const pedido=(pedidoOuId&&typeof pedidoOuId==='object')?pedidoOuId:{id:pedidoOuId};
  try{await update(ref(remoteDb,'pedidos_realtime/'+pedido.id),{notaFiscal:!currentStatus});}catch(e){alert("Erro.");}
}
function abrirModalRateioPagamento(pedido){
  const modal=document.getElementById('modalRateioPagamento');const resumo=document.getElementById('rateioPagamentoResumo');const campos=document.getElementById('rateioPagamentoCampos');
  if(!modal||!resumo||!campos)return;const total=parseValor(pedido.valor);const partes=String(pedido.pagamento||'').split('+').map(p=>p.trim().toUpperCase()).filter(Boolean);
  const rateioAtual=(pedido.rateioPagamento&&typeof pedido.rateioPagamento==='object')?pedido.rateioPagamento:{};
  pedidoPendenteRateio=pedido;
  resumo.innerHTML='<strong>Pedido:</strong> '+pedido.cliente+'<br><strong>Total:</strong> '+fmtMoeda(total);
  campos.innerHTML='';
  partes.forEach(parte=>{
    const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:1fr 120px;gap:8px;align-items:center';
    row.innerHTML='<label style="font-weight:600;">'+parte+'</label><input type="number" step="0.01" min="0" class="input-rateio-pagamento" data-parte="'+parte+'" value="'+(Number(rateioAtual[parte]||0).toFixed(2))+'" style="padding:8px;border:1px solid #ccc;border-radius:6px">';
    campos.appendChild(row);
  });
  const inputs=campos.querySelectorAll('.input-rateio-pagamento');
  if(inputs.length>0&&!Object.keys(rateioAtual).length){inputs[0].value=(total/2).toFixed(2);if(inputs[1])inputs[1].value=(total/2).toFixed(2);inputs[0].focus();}
  modal.style.display='block';
}
async function salvarRateioPagamentoEConferir(){
  if(!pedidoPendenteRateio)return;const pedido=pedidoPendenteRateio;
  const campos=Array.from(document.querySelectorAll('#rateioPagamentoCampos .input-rateio-pagamento'));
  const total=parseValor(pedido.valor);const rateio={};let soma=0;
  for(const inp of campos){const parte=(inp.dataset.parte||'').trim().toUpperCase();const v=Number(inp.value);if(!parte)continue;if(!Number.isFinite(v)||v<0){alert('Valor inválido para '+parte);inp.focus();return;}rateio[parte]=Number(v.toFixed(2));soma+=rateio[parte];}
  if(Math.abs(soma-total)>0.01){alert('A soma do rateio ('+fmtMoeda(soma)+') deve ser igual ao total ('+fmtMoeda(total)+').');return;}
  try{await update(ref(remoteDb,'pedidos_realtime/'+pedido.id),{conferido:true,rateioPagamento:rateio});document.getElementById('modalRateioPagamento').style.display='none';pedidoPendenteRateio=null;mostrarMensagemSucesso('Rateio salvo! ✅');}catch(e){alert("Erro ao salvar rateio.");}
}

// ========== AUTOCOMPLETE ==========
function atualizarDatalist(){
  const listNomes=document.getElementById('listaClientes');const listTels=document.getElementById('listaTelefones');const listEnds=document.getElementById('listaEnderecos');
  if(listNomes)listNomes.innerHTML='';if(listTels)listTels.innerHTML='';if(listEnds)listEnds.innerHTML='';
  const nomes=new Set();const tels=new Set();const ends=new Set();
  todosPedidosFirebase.forEach(p=>{if(p.cliente)nomes.add(p.cliente.trim().toUpperCase());if(p.telefone)tels.add(p.telefone.trim());if(p.endereco)ends.add(p.endereco.trim().toUpperCase());});
  if(clientesCadastradosGlobais)Object.values(clientesCadastradosGlobais).forEach(c=>{if(c.nome)nomes.add(c.nome.trim().toUpperCase());if(c.cliente)nomes.add(c.cliente.trim().toUpperCase());if(c.tel)tels.add(c.tel.trim());if(c.telefone)tels.add(c.telefone.trim());if(c.rua)ends.add(c.rua.trim().toUpperCase());if(c.endereco)ends.add(c.endereco.trim().toUpperCase());});
  if(listNomes)nomes.forEach(n=>{const o=document.createElement('option');o.value=n;listNomes.appendChild(o);});
  tels.forEach(t=>{const o=document.createElement('option');o.value=t;listTels.appendChild(o);});
  if(listEnds)ends.forEach(e=>{const o=document.createElement('option');o.value=e;listEnds.appendChild(o);});
}

// ========== UTILITIES ==========
function copiarTextoParaClipboard(texto){if(!texto)return;navigator.clipboard.writeText(texto).then(()=>mostrarMensagemSucesso("Texto copiado! ✅")).catch(()=>alert("Não foi possível copiar."));}
function copiarMensagemRecompra(p){const data=p.data.split(' ')[0];copiarTextoParaClipboard('Olá, '+p.cliente+'! 😊\n\nPassando para lembrar que o seu gás pode estar acabando. 🕒\nSua última compra foi em: '+data+'.\n\nPara não ficar na mão, é só responder essa mensagem que entregamos rapidinho! 🔥\n\n*Canoas Gás*');}
function mascaraMoeda(campo){let v=campo.value.replace(/\D/g,"");v=(v/100).toFixed(2)+"";v=v.replace(".",",");v=v.replace(/(\d)(?=(\d{3})+(?!\d))/g,"$1.");campo.value=v;}
function mascaraTelefone(campo){let v=campo.value.replace(/\D/g,"");if(v.length>0)v="("+v;if(v.length>3)v=v.slice(0,3)+") "+v.slice(3);if(v.length>10)v=v.slice(0,10)+"-"+v.slice(10,15);else if(v.length>9)v=v.slice(0,9)+"-"+v.slice(9);campo.value=v;if(v.length>=14)buscarUltimoPedidoPorTelefone(v);}
function buscarUltimoPedidoPorTelefone(tel){
  const historico=todosPedidosFirebase.filter(p=>p.telefone===tel);if(historico.length===0)return;
  const grupos={};historico.forEach(p=>{const addr=(p.endereco||'').trim().toUpperCase();if(addr.length>3){if(!grupos[addr])grupos[addr]=[];grupos[addr].push(p);}});
  const enderecos=Object.keys(grupos);if(enderecos.length===0)return;
  const container=document.getElementById('listaEnderecosEncontrados');container.innerHTML='';
  const telLimp=tel.replace(/\D/g,'');
  if(clientesBlacklist&&clientesBlacklist[telLimp]){const b=document.createElement('div');b.className='blacklist-modal-banner';b.innerHTML='<h3 style="color:#ff1744;margin:0">🚫 CLIENTE BLACKLIST</h3><p style="color:#ff6b6b">Não efetue a venda.</p>';container.appendChild(b);}
  enderecos.forEach(addr=>{
    const pedidosDoEnd=grupos[addr].sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));const ultimo=pedidosDoEnd[0];
    const div=document.createElement('div');div.style.cssText='padding:12px;border:1px solid #eee;border-radius:8px;margin-bottom:8px;cursor:pointer;background:#fff';
    div.innerHTML='<div style="font-weight:bold;color:var(--text-color);margin-bottom:5px">🏠 '+(ultimo.endereco||'')+'</div><div style="font-size:12px;color:#666;display:flex;justify-content:space-between">📅 Último: <b>'+(ultimo.data?ultimo.data.split(' ')[0]:'')+'</b><span style="background:#f1f2f6;padding:2px 8px;border-radius:10px;font-weight:bold;color:var(--primary-color)">'+pedidosDoEnd.length+' pedidos</span></div>';
    div.onclick=()=>{carregarParaEdicao(ultimo);document.getElementById('modalSelecaoEndereco').style.display='none';mostrarMensagemSucesso("Endereço selecionado! ✅");};
    container.appendChild(div);
  });
  document.getElementById('modalSelecaoEndereco').style.display='block';
}
function mostrarMensagemSucesso(txt){const msg=document.getElementById('successToast');msg.innerText=txt||"Sucesso! ✅";msg.style.display='block';setTimeout(()=>msg.style.display='none',3000);}

// ========== CLIPBOARD PARSING ==========
function processarNumeroWhatsApp(texto){
  let num=texto.replace(/\D/g,'');if(num.startsWith('55')&&num.length>10)num=num.substring(2);
  if(num.length===11)num='('+num.substring(0,2)+') '+num.substring(2,7)+'-'+num.substring(7);
  else if(num.length===10)num='('+num.substring(0,2)+') 9'+num.substring(2,6)+'-'+num.substring(6);
  const inp=document.getElementById('telefone');inp.value=num;inp.dispatchEvent(new Event('input'));
}
function processarTextoClipboard(texto){
  if(!texto)return;const linhas=texto.split('\n').map(l=>l.trim()).filter(l=>l.length>0);
  const temChave=linhas.length>3&&linhas.some(l=>l.toUpperCase().includes("CEP:")||l.toLowerCase().includes("total")||l.toLowerCase().includes("entregador"));
  if(!temChave){processarNumeroWhatsApp(texto);return;}
  let nome='';if(linhas.length>0)nome=linhas[0].replace(/\(\d+\s*pedidos?\)/gi,'').trim();
  let telefone='';const foneRegex=/\(?\d{2}\)?\s*\d{4,5}-\d{4}/;
  for(let i=0;i<Math.min(linhas.length,4);i++){if(foneRegex.test(linhas[i])&&!linhas[i].toLowerCase().includes("motorista")&&!linhas[i].toLowerCase().includes("canoas")){const m=linhas[i].match(foneRegex);if(m){telefone=m[0];break;}}}
  let endereco='',cep='',idxCep=-1;
  for(let i=0;i<linhas.length;i++){if(linhas[i].toUpperCase().includes("CEP:")){cep=linhas[i].replace(/CEP:\s*/gi,'').trim();idxCep=i;break;}}
  if(idxCep>0){endereco=linhas[idxCep-1];if(cep)endereco+=' - CEP: '+cep;}
  else{for(let i=0;i<linhas.length;i++){if(linhas[i].toLowerCase().includes("rua")||linhas[i].toLowerCase().includes("av.")||linhas[i].toLowerCase().includes("avenida")||(linhas[i].includes(",")&&/\d+/.test(linhas[i]))){endereco=linhas[i];break;}}}
  let valor='';for(let i=0;i<linhas.length;i++){if(linhas[i].toLowerCase()==="total"&&i+1<linhas.length){valor=linhas[i+1].replace("R$","").trim();break;}}
  if(!valor){for(let i=linhas.length-1;i>=0;i--){if(linhas[i].includes("R$")){valor=linhas[i].replace("R$","").trim();break;}}}
  let pagamento='';const t=texto.toLowerCase();
  if(t.includes("crédito")||t.includes("credito")||t.includes("cartão de crédito"))pagamento="CRÉDITO";
  else if(t.includes("débito")||t.includes("debito")||t.includes("cartão de débito"))pagamento="DÉBITO";
  else if(t.includes("pix"))pagamento="PIX";
  else if(t.includes("dinheiro"))pagamento="DINHEIRO";
  else if(t.includes("a prazo"))pagamento="A PRAZO";
  else if(t.includes("on line")||t.includes("online"))pagamento="ON LINE";
  let canalVenda='';
  if(t.includes("appgas")||t.includes("app gás"))canalVenda="APP GAS";
  else if(t.includes("google"))canalVenda="DISK GOOGLE";
  else if(t.includes("gasbh")||t.includes("site gasbh")||t.includes("site gas bh"))canalVenda="SITE GASBH";
  else if(t.includes("portaria"))canalVenda="PORTARIA";
  let produto='',qtd='';
  for(let i=0;i<linhas.length;i++){const l=linhas[i].toLowerCase();if(l.includes("botijão")||l.includes("gás 13kg")||l.includes("gás de 13")||l.includes("supergasbras"))produto="Gás 13kg";else if(l.includes("água mineral")||l.includes("agua mineral"))produto="Água Mineral-20 litros";if(/^\d+\s*x$/i.test(l))qtd=l.replace(/x/i,'').trim();}
  const set=(id,val)=>{const el=document.getElementById(id);if(el){el.value=val;el.dispatchEvent(new Event('input',{bubbles:true}));}};
  if(nome)set('nome',nome);if(telefone)set('telefone',telefone);
  if(endereco)set('endereco',endereco);if(valor)set('valor',valor);
  if(pagamento){const el=document.getElementById('pagamento');if(el){el.value=pagamento;el.dispatchEvent(new Event('change',{bubbles:true}));}}
  if(canalVenda){const el=document.getElementById('canalVenda');if(el){el.value=canalVenda;el.dispatchEvent(new Event('change',{bubbles:true}));}}
  if(produto){const el=document.getElementById('produto');if(el){el.value=produto;el.dispatchEvent(new Event('change',{bubbles:true}));}}
  if(qtd)set('qtd',qtd);
  mostrarMensagemSucesso("Pedido colado! ✅");
}
function colarNumeroWhatsApp(){navigator.clipboard.readText().then(processarTextoClipboard);}
function preencherPortaria(){
  document.getElementById('nome').value='Portaria';document.getElementById('telefone').value='Sem numero';
  document.getElementById('endereco').value='Rua das canoas 757 Betania';document.getElementById('informacoes').value='Portaria / Canal de venda Portaria';
  const el=document.getElementById('canalVenda');if(el){el.value='PORTARIA';el.dispatchEvent(new Event('change',{bubbles:true}));}
  ['nome','telefone','endereco','informacoes'].forEach(id=>{const e=document.getElementById(id);if(e)e.dispatchEvent(new Event('input',{bubbles:true}));});
}

// ========== PRINT CONFIG ==========
function salvarConfigImpressao(){
  const checkboxes=document.querySelectorAll('#printOptionsGrid input[type=checkbox]');const marcados=[];checkboxes.forEach(cb=>{if(cb.checked)marcados.push(cb.value);});
  localStorage.setItem('printConfig_pagamentos',JSON.stringify(marcados));
  const auto=document.getElementById('toggleImpressaoAuto');localStorage.setItem('printConfig_automatico',auto?auto.checked:false);
  const naEntrega=document.getElementById('toggleImpressaoEntrega');localStorage.setItem('printConfig_naEntrega',naEntrega?naEntrega.checked:false);
  const paper=document.querySelector('input[name=paperSize]:checked');localStorage.setItem('printConfig_paperSize',paper?paper.value:'58');
}
function carregarConfigImpressao(){
  try{
    const opcoes=["DINHEIRO","PIX","DÉBITO","CRÉDITO","A PRAZO","ON LINE","PIX+CARTÃO","PIX+DINHEIRO","DINHEIRO+CARTÃO","GAS DO POVO","PESQUISA"];
    const salvo=JSON.parse(localStorage.getItem('printConfig_pagamentos')||JSON.stringify(opcoes));
    const grid=document.getElementById('printOptionsGrid');grid.innerHTML='';
    opcoes.forEach(v=>{grid.innerHTML+='<label class="print-option"><input type="checkbox" value="'+v+'" onchange="salvarConfigImpressao()" '+(salvo.includes(v)?'checked':'')+'>'+v+'</label>';});
    const auto=document.getElementById('toggleImpressaoAuto');if(auto)auto.checked=localStorage.getItem('printConfig_automatico')==='true';
    const naEntrega=document.getElementById('toggleImpressaoEntrega');if(naEntrega)naEntrega.checked=localStorage.getItem('printConfig_naEntrega')==='true';
    const sz=localStorage.getItem('printConfig_paperSize')||'58';const r=document.querySelector('input[name=paperSize][value="'+sz+'"]');if(r)r.checked=true;
  }catch(e){console.error(e);}
}
function carregarConfigPromo(){
  try{
    const canais=["DISK ENTREGA","APP GAS","PRECO DO GAS","PORTARIA","GAS DO POVO PORTARIA","DISK GOOGLE","TAXA DISK GAS POVO","PESQUISA","SITE GASBH"];
    const salvo=JSON.parse(localStorage.getItem('promoConfig_canais')||'[]');
    const grid=document.getElementById('promoChannelsGrid');grid.innerHTML='';
    canais.forEach(v=>{grid.innerHTML+='<label class="print-option"><input type="checkbox" value="'+v+'" onchange="salvarConfigPromo()" '+(salvo.includes(v)?'checked':'')+'>'+v+'</label>';});
  }catch(e){console.error(e);}
}
function salvarConfigPromo(){
  const checkboxes=document.querySelectorAll('#promoChannelsGrid input[type=checkbox]');const marcados=[];checkboxes.forEach(cb=>{if(cb.checked)marcados.push(cb.value);});
  localStorage.setItem('promoConfig_canais',JSON.stringify(marcados));
}

// ========== THERMAL PRINT ==========
function imprimirRecibo(dados,displayProd,isConcluido=false,isReprint=false,isManualAction=false){
  const opcoes=["DINHEIRO","PIX","DÉBITO","CRÉDITO","A PRAZO","ON LINE","PIX+CARTÃO","PIX+DINHEIRO","DINHEIRO+CARTÃO","GAS DO POVO","PESQUISA"];
  const pagsSel=JSON.parse(localStorage.getItem('printConfig_pagamentos')||JSON.stringify(opcoes));
  if(!isReprint){if(dados.pagamento&&!pagsSel.includes(dados.pagamento))return;if(!isManualAction){if(!isConcluido){if(localStorage.getItem('printConfig_automatico')!=='true')return;}}}
  const numSeq=dados.numSeq||obterProximoSequencial();const prodDisplay=displayProd||dados.produto;
  const paperSize=localStorage.getItem('printConfig_paperSize')||'58';const is58=paperSize==='58';
  const css=is58?'@page{margin:0;size:58mm auto}*{margin:0;padding:0;box-sizing:border-box}body{font-family:\'Courier New\',monospace;width:58mm;padding:3mm;font-size:11px;line-height:1.3;color:#000}.th{display:flex;justify-content:space-between;margin-bottom:5px}.ttl{font-size:13px;font-weight:bold}.seq{font-size:16px;font-weight:900;background:#000;color:#fff;padding:1px 4px;border-radius:2px}.div{border-top:1px dashed #000;margin:4px 0}.cf{margin-bottom:2px}.cf .lb{font-weight:bold}.dst{font-size:14px;font-weight:bold;text-align:center;margin:4px 0}.rod{text-align:center;font-size:14px;font-weight:bold;margin-top:6px}':'@page{margin:0;size:80mm auto}*{margin:0;padding:0;box-sizing:border-box}body{font-family:\'Courier New\',monospace;width:80mm;padding:5mm;font-size:12px;line-height:1.4;color:#000}.th{display:flex;justify-content:space-between;margin-bottom:8px}.ttl{font-size:16px;font-weight:bold}.seq{font-size:20px;font-weight:900;background:#000;color:#fff;padding:2px 6px;border-radius:4px}.div{border-top:1px dashed #000;margin:6px 0}.cf{margin-bottom:3px}.cf .lb{font-weight:bold}.dst{font-size:16px;font-weight:bold;text-align:center;margin:6px 0}.rod{text-align:center;font-size:16px;font-weight:bold;margin-top:10px}';
  const lblE=is58?'Entreg':'Entregador';const lblEnd=is58?'End':'Endereço';const lblP=is58?'Prod':'Produto';const lblPg=is58?'Pgto':'Pagamento';
  const content='<html><head><meta charset="UTF-8"><title>Recibo</title><style>'+css+'</style></head><body><div class="th"><div class="ttl">'+(isConcluido?'RECIBO DE ENTREGA':'ORDEM DE ENTREGA')+'</div><div class="seq">'+numSeq+'</div></div>'+(isConcluido?'<div style="text-align:center;font-weight:900;font-size:18px;border:2px solid #000;margin:5px 0;padding:2px">*** ENTREGUE ***</div>':'')+'<div class="div"></div><div class="cf"><span class="lb">'+lblE+':</span> '+dados.entregador+'</div><div class="div"></div><div class="cf"><span class="lb">Cliente:</span> '+dados.cliente+'</div><div class="cf"><span class="lb">Canal:</span> '+(dados.canalVenda||'-')+'</div><div class="cf"><span class="lb">Tel:</span> '+dados.telefone+'</div><div class="cf"><span class="lb">'+lblEnd+':</span> '+dados.endereco+'</div><div class="cf"><span class="lb">'+lblP+':</span> '+prodDisplay+'</div><div class="cf"><span class="lb">Info:</span> '+(dados.informacoes||'-')+'</div><div class="div"></div><div class="cf"><span class="lb">'+lblPg+':</span> '+dados.pagamento+'</div><div class="dst">R$ '+dados.valor+'</div><div class="div"></div><div class="rod">'+(dados.data||'')+'<br>Canoas Gás</div></body></html>';
  const w=window.open('','_blank','width='+(is58?260:350)+',height=500');if(w){w.document.write(content);w.document.close();setTimeout(()=>{w.focus();w.print();setTimeout(()=>w.close(),1000);},300);}else alert('Libere os popups para imprimir.');
}

// ========== MODALS ==========
function processarFaturamento(){
  let total=0;const porForma={},porEntregador={};
  pedidosFiltradosGlobal.forEach(p=>{const v=parseValor(p.valor);if(v<=0)return;total+=v;const pag=p.pagamento||'OUTROS';porForma[pag]=(porForma[pag]||0)+v;const ent=p.entregador||'NÃO DEFINIDO';if(!porEntregador[ent])porEntregador[ent]={total:0,formas:{}};porEntregador[ent].total+=v;porEntregador[ent].formas[pag]=(porEntregador[ent].formas[pag]||0)+v;});
  document.getElementById('fatTotalGeral').innerText=fmtMoeda(total);
  // Charts
  const ctxPag=document.getElementById('chartPagamento');const ctxEnt=document.getElementById('chartEntregador');
  if(window._chartPag)window._chartPag.destroy();if(window._chartEnt)window._chartEnt.destroy();
  if(ctxPag)window._chartPag=new Chart(ctxPag,{type:'doughnut',data:{labels:Object.keys(porForma),datasets:[{data:Object.values(porForma),backgroundColor:['#ff7675','#74b9ff','#55efc4','#fdcb6e','#a29bfe','#e17055','#00cec9','#fd79a8','#636e72','#f39c12','#2ecc71']}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{size:10}}}}}});
  if(ctxEnt)window._chartEnt=new Chart(ctxEnt,{type:'bar',data:{labels:Object.keys(porEntregador),datasets:[{label:'Receita',data:Object.values(porEntregador).map(v=>v.total),backgroundColor:'#00b894'}]},options:{responsive:true,plugins:{legend:{display:false}}}});
  const detalhes=document.getElementById('detalhesFinanceiros');
  detalhes.innerHTML=Object.keys(porEntregador).sort().map(k=>'<div style="background:#f1f1f1;border-radius:8px;padding:10px;margin-bottom:8px"><div style="display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding-bottom:5px;margin-bottom:5px"><span style="font-weight:bold">🛵 '+k+'</span><span style="font-weight:bold;color:#007bff">'+fmtMoeda(porEntregador[k].total)+'</span></div>'+Object.keys(porEntregador[k].formas).map(f=>'<div style="font-size:12px;display:flex;justify-content:space-between;color:#555"><span>'+f+'</span><span>'+fmtMoeda(porEntregador[k].formas[f])+'</span></div>').join('')+'</div>').join('');
  document.getElementById('modalFaturamento').style.display='block';
}
function gerarPrevisaoRetencao(){
  const hoje=new Date();hoje.setHours(0,0,0,0);
  const ativos=pedidosFiltradosGlobal.filter(p=>{if(!p.duracaoGas||p.duracaoGas<=0)return false;try{const[d,dataPart]=p.data.split(/[\s,]+/);const[d2,m2,y2]=dataPart.split('/');const dataCompra=new Date(y2+'-'+m2+'-'+d2);const passados=Math.ceil(Math.abs(hoje-dataCompra)/86400000);return(p.duracaoGas-passados)>0;}catch{return false;}});
  if(ativos.length===0){alert("Nenhum cliente com gás ativo.");return;}
  const csv="data:text/csv;charset=utf-8,\uFEFF"+"Cliente,Telefone,Endereco,Data Compra,Dias Restantes\n"+ativos.map(p=>{const[d2,dataPart]=p.data.split(/[\s,]+/);const[d3,m3,y3]=dataPart.split('/');const dataCompra=new Date(y3+'-'+m3+'-'+d3);const passados=Math.ceil(Math.abs(hoje-dataCompra)/86400000);return'"'+p.cliente+'","'+p.telefone+'","'+p.endereco+'","'+p.data+'","'+(p.duracaoGas-passados)+'"';}).join("\n");
  const a=document.createElement("a");a.href=encodeURI(csv);a.download="previsao_recompra_gas.csv";document.body.appendChild(a);a.click();document.body.removeChild(a);
}
function exportarExcel(){
  const dados=pedidosFiltradosGlobal||[];if(dados.length===0){alert('Nenhum dado para exportar.');return;}
  const cabecalho=['Data','Produto','Valor','','','Pagamento','Canal de Venda','Entregador','Endereço'];
  const dadosOrdenados=[...dados].sort((a,b)=>{
    const parseDate=(str)=>{const[dP]=(str||'').split(/[\s,]+/);const[d,m,y]=(dP||'').split('/');return new Date(`${y}-${m}-${d}`);};
    const compData=parseDate(a.data)-parseDate(b.data);
    if(compData!==0)return compData;
    const entA=(a.entregador||'').trim().toLowerCase();
    const entB=(b.entregador||'').trim().toLowerCase();
    return entA.localeCompare(entB,'pt-BR');
  });
  const linhas=dadosOrdenados.map(p=>{
    const numTel=(p.telefone||p.tel||'').trim();
    const telStr=numTel?` - ${numTel}`:'';
    let prod=p.produto||'';
    if(prod.trim().toUpperCase()==='GÁS 13KG'||prod.trim().toUpperCase()==='1X GÁS 13KG'||prod.trim()==='Gás 13kg'||prod.trim()==='1x Gás 13kg'){prod='SUPERGASBRAS';}
    const dataApenas=(p.data||'').split(/[\s,]+/)[0]||'';
    return [dataApenas,prod,p.valor||'','','',p.pagamento||'',p.canalVenda||'',p.entregador||'',(p.endereco||'')+telStr];
  });
  const totalV=dados.reduce((acc,p)=>acc+parseValor(p.valor),0);
  const estilo='style="border-collapse:collapse;font-family:Arial;font-size:12px;width:100%"';
  let html='<table border="1" '+estilo+'><thead><tr>'+cabecalho.map(h=>'<th style="background:#2d3436;color:#fff;font-weight:bold;padding:10px 8px;border:1px solid #ccc">'+h+'</th>').join('')+'</tr></thead><tbody>';
  linhas.forEach(row=>{html+='<tr>'+row.map((c,i)=>'<td style="padding:8px;border:1px solid #ddd'+(i===2?';text-align:right':'')+'">'+String(c).replace(/</g,'&lt;')+'</td>').join('')+'</tr>';});
  html+='<tr><td style="padding:8px;border:1px solid #ccc;background:#f1f2f6;font-weight:bold" colspan="2">TOTAL — '+dados.length+' pedido(s)</td><td style="padding:8px;border:1px solid #ccc;background:#f1f2f6;font-weight:bold;text-align:right">'+fmtMoeda(totalV)+'</td><td style="padding:8px;border:1px solid #ccc;background:#f1f2f6" colspan="6"></td></tr>';
  html+='</tbody></table>';
  const blob=new Blob(['\ufeff'+html],{type:'application/vnd.ms-excel'});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="relatorio_vendas.xls";a.click();
}
async function exportarJSON(){
  try{const blob=new Blob([JSON.stringify(todosPedidosFirebase,null,2)],{type:'application/json'});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download='backup_pedidos_'+new Date().toISOString().split('T')[0]+'.json';a.click();mostrarMensagemSucesso("JSON exportado! 💾");}catch(e){alert("Erro ao exportar JSON.");}
}
async function importarJSON(){
  const inp=document.createElement('input');inp.type='file';inp.accept='.json';
  inp.onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    const text=await file.text();try{
      const pedidos=JSON.parse(text);let novos=0;
      const existentes=new Set(todosPedidosFirebase.map(p=>gerarChaveUnica(p)));
      for(const p of pedidos){if(!existentes.has(gerarChaveUnica(p))){delete p.id;if(!p.timestamp)p.timestamp=Date.now();await push(ref(remoteDb,'pedidos_realtime'),p);novos++;}}
      alert(novos>0?novos+' novos pedidos importados! ☁️':"Todos os pedidos já existem no banco.");
    }catch(err){alert("Erro ao processar JSON: "+err.message);}
  };inp.click();
}
function gerarChaveUnica(p){return ((p.data||'')+'-'+(p.cliente||'')+'-'+(p.endereco||'')).toLowerCase();}

// Historical Annual
function abrirHistoricoAnualView(){abrirHistoricoAnual();document.getElementById('tab-relatorios').scrollIntoView();}
function abrirHistoricoAnual(){
  const sel=document.getElementById('selectAnoHistorico');sel.innerHTML='';const anoAtual=new Date().getFullYear();
  for(let a=anoAtual;a>=2020;a--){const o=document.createElement('option');o.value=a;o.textContent=a;sel.appendChild(o);}
  sel.value=anoAtual;processarHistoricoAnual();document.getElementById('modalHistoricoAnual').style.display='block';
}
function processarHistoricoAnual(){
  const ano=parseInt(document.getElementById('selectAnoHistorico').value);const container=document.getElementById('containerHistoricoAnual');
  const meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  let totalAno=0;let html='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px">';
  meses.forEach((mes,idx)=>{
    const pedidosMes=todosPedidosFirebase.filter(p=>{if(!p.data)return false;try{const[d,m]=p.data.split(/[\s,]+/)[0].split('/');return parseInt(m)===idx+1&&parseInt(d.split('/')[2]||d)===ano;}catch{return false;}});
    if(pedidosMes.length===0){html+='<div style="background:#f8f9fa;border-radius:12px;padding:15px;text-align:center;opacity:0.5"><h4 style="font-size:14px;color:#636e72;margin-bottom:8px">'+mes+'</h4><p style="font-size:12px;color:#999">0 pedidos</p></div>';return;}
    let totalMes=0;const produtos={};const canais={};
    pedidosMes.forEach(p=>{const v=parseValor(p.valor);totalMes+=v;const pr=p.produto||'OUTROS';produtos[pr]=(produtos[pr]||0)+v;const ca=p.canalVenda||'OUTROS';canais[ca]=(canais[ca]||0)+1;});
    totalAno+=totalMes;
    const topProd=Object.entries(produtos).sort((a,b)=>b[1]-a[1]).slice(0,3);
    html+='<div style="background:white;border-radius:12px;padding:15px;box-shadow:0 2px 8px rgba(0,0,0,0.05);cursor:pointer;transition:transform 0.2s" onclick="mostrarDetalheMes('+idx+','+ano+')" onmouseover="this.style.transform=\'scale(1.02)\'" onmouseout="this.style.transform=\'scale(1)\'">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:8px">'+
      '<h4 style="font-size:15px;color:var(--primary-color);margin:0">'+mes+'</h4>'+
      '<span style="font-size:13px;font-weight:700;color:var(--success-color)">'+fmtMoeda(totalMes)+'</span></div>'+
      '<div style="font-size:12px;color:#636e72">📦 '+pedidosMes.length+' pedidos</div>'+
      '<div style="font-size:11px;color:#999;margin-top:5px">'+topProd.map(([k,v])=>k+': '+fmtMoeda(v)).join(' | ')+'</div></div>';
  });
  html+='</div>';container.innerHTML=html;
  document.getElementById('totalAnoHistorico').innerText=fmtMoeda(totalAno);
}
function mostrarDetalheMes(mesIdx,ano){
  const meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  document.getElementById('tituloDetalheMes').innerText='📊 '+meses[mesIdx]+' '+ano;
  const pedidosMes=todosPedidosFirebase.filter(p=>{if(!p.data)return false;try{const[d,m]=p.data.split(/[\s,]+/)[0].split('/');return parseInt(m)===mesIdx+1&&parseInt(d.split('/')[2]||d)===ano;}catch{return false;}});
  const produtos={},canais={};let total=0;
  pedidosMes.forEach(p=>{const v=parseValor(p.valor);total+=v;const pr=p.produto||'OUTROS';produtos[pr]=(produtos[pr]||0)+v;const ca=p.canalVenda||'OUTROS';canais[ca]=(canais[ca]||0)+1;});
  const lista=document.getElementById('listaProdutosDetalhe');
  lista.innerHTML=Object.entries(produtos).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0"><span>'+k+'</span><span style="font-weight:bold;color:var(--primary-color)">'+fmtMoeda(v)+'</span></div>').join('')+
    '<div style="display:flex;justify-content:space-between;padding:8px 0;margin-top:5px;border-top:2px solid var(--primary-color);font-weight:bold"><span>TOTAL</span><span>'+fmtMoeda(total)+'</span></div>';
  document.getElementById('tituloCanalVenda').innerText='📍 Canal de Venda';
  if(window._chartPizza)window._chartPizza.destroy();if(window._chartFormas)window._chartFormas.destroy();
  const ctx1=document.getElementById('chartPizzaProdutos');
  if(ctx1)window._chartPizza=new Chart(ctx1,{type:'doughnut',data:{labels:Object.keys(produtos),datasets:[{data:Object.values(produtos),backgroundColor:['#ff7675','#74b9ff','#55efc4','#fdcb6e','#a29bfe','#e17055','#00cec9']}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{size:10}}}}}});
  const ctx2=document.getElementById('chartPizzaFormas');
  if(ctx2)window._chartFormas=new Chart(ctx2,{type:'doughnut',data:{labels:Object.keys(canais),datasets:[{data:Object.values(canais),backgroundColor:['#0984e3','#00b894','#e17055','#fdcb6e','#6c5ce7','#ff7675','#00cec9']}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{size:10}}}}}});
  document.getElementById('modalDetalheMensal').style.display='block';
}
function exportarHistoricoAnualExcel(){
  const ano=parseInt(document.getElementById('selectAnoHistorico').value);
  const meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  let html='<table border="1" style="border-collapse:collapse;font-family:Arial;font-size:12px"><thead><tr><th>Mês</th><th>Pedidos</th><th>Total</th><th>Produtos</th></tr></thead><tbody>';
  meses.forEach((mes,idx)=>{
    const pedidosMes=todosPedidosFirebase.filter(p=>{if(!p.data)return false;try{const[d,m]=p.data.split(/[\s,]+/)[0].split('/');return parseInt(m)===idx+1&&parseInt(d.split('/')[2]||d)===ano;}catch{return false;}});
    if(pedidosMes.length===0){html+='<tr><td>'+mes+'</td><td>0</td><td>R$ 0,00</td><td>-</td></tr>';return;}
    const total=pedidosMes.reduce((acc,p)=>acc+parseValor(p.valor),0);
    const prods=Object.entries(pedidosMes.reduce((acc,p)=>{const pr=p.produto||'OUTROS';acc[pr]=(acc[pr]||0)+1;return acc;},{}).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>k+' ('+v+')').join(', ');
    html+='<tr><td>'+mes+'</td><td>'+pedidosMes.length+'</td><td>'+fmtMoeda(total)+'</td><td>'+prods+'</td></tr>';
  });
  html+='</tbody></table>';
  const blob=new Blob(['\ufeff'+html],{type:'application/vnd.ms-excel'});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download='historico_anual_'+ano+'.xls';a.click();
}

// Venda Retroativa
function abrirModalInserirVendaRetroativa(){
  const ontem=new Date(Date.now()-86400000);const y=ontem.getFullYear();const m=String(ontem.getMonth()+1).padStart(2,'0');const d=String(ontem.getDate()).padStart(2,'0');const h=String(ontem.getHours()).padStart(2,'0');const min=String(ontem.getMinutes()).padStart(2,'0');
  document.getElementById('retroDataVenda').value=y+'-'+m+'-'+d+'T'+h+':'+min;
  const sel=document.getElementById('retroEntregador');sel.innerHTML='<option value="">Selecione...</option>';
  const lista=equipeEntregadores.length>0?equipeEntregadores:JSON.parse(localStorage.getItem('cache_equipe')||'[]');
  lista.forEach(e=>{const o=document.createElement('option');o.value=e.nome;o.textContent=e.nome;sel.appendChild(o);});
  document.getElementById('modalVendaRetroativa').style.display='block';
}
function fecharModalVendaRetroativa(){document.getElementById('modalVendaRetroativa').style.display='none';}
function salvarVendaRetroativa(){
  const dataStr=document.getElementById('retroDataVenda').value;if(!dataStr){alert("Selecione a data da venda.");return;}
  const dataObj=new Date(dataStr);const dataFormatada=dataObj.toLocaleString('pt-BR');
  const dados={data:dataFormatada,cliente:document.getElementById('retroNome').value.trim(),telefone:document.getElementById('retroTelefone').value||"Não informado",endereco:document.getElementById('retroEndereco').value.trim(),bairro:document.getElementById('retroBairro').value.trim(),canalVenda:document.getElementById('retroCanalVenda').value,produto:document.getElementById('retroProduto').value,entregador:document.getElementById('retroEntregador').value,pagamento:document.getElementById('retroPagamento').value,valor:document.getElementById('retroValor').value,qtd:parseInt(document.getElementById('retroQtd').value)||1,informacoes:document.getElementById('retroInformacoes').value,statusEntrega:'Concluída',tempo_concluido:dataFormatada,timestamp:dataObj.getTime()};
  if(!dados.cliente||!dados.endereco||!dados.valor){alert("Preencha nome, endereço e valor.");return;}
  push(ref(remoteDb,'pedidos_realtime'),dados).then(()=>{alert("Venda retroativa salva! ✅");fecharModalVendaRetroativa();});
}

// Localizar Entregadores
function localizarEntregadores(){
  const container=document.getElementById('listaEntregadoresOnline');
  container.innerHTML='<p style="font-size:13px;color:#999;text-align:center">Carregando...</p>';
  document.getElementById('modalLocalizar').style.display='block';
  onValue(ref(remoteDb,'status_entregadores'),snapshot=>{
    const data=snapshot.val();container.innerHTML='';
    if(!data){container.innerHTML='<p style="font-size:13px;color:#999;text-align:center">Nenhum entregador online.</p>';return;}
    Object.keys(data).forEach(key=>{
      const e=data[key];if(!e||!e.lat||!e.lng)return;
      const div=document.createElement('div');div.style.cssText='padding:12px;border:1px solid #eee;border-radius:8px;margin-bottom:8px';
      div.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center">'+
        '<span style="font-weight:bold">🛵 '+(e.nome||key)+'</span>'+
        '<a href="https://www.google.com/maps?q='+e.lat+','+e.lng+'" target="_blank" style="background:#007bff;color:white;padding:4px 12px;border-radius:6px;text-decoration:none;font-size:12px">📍 Ver no Mapa</a></div>'+
        '<div style="font-size:11px;color:#999;margin-top:5px">⏱️ '+(e.timestamp?new Date(e.timestamp).toLocaleString('pt-BR'):'-')+'</div>';
      container.appendChild(div);
    });
  },{onlyOnce:true});
}

// Busca Cliente
function abrirBuscaCliente(){document.getElementById('inputBuscaCliente').value='';document.getElementById('resultadoBuscaCliente').innerHTML='';document.getElementById('modalBuscaCliente').style.display='block';}
function fecharBuscaCliente(){document.getElementById('modalBuscaCliente').style.display='none';}
function buscarClientesModal(){
  const q=(document.getElementById('inputBuscaCliente').value||'').toUpperCase();
  const container=document.getElementById('resultadoBuscaCliente');container.innerHTML='';
  if(!q||q.length<2){container.innerHTML='<p style="font-size:12px;color:#999;text-align:center">Digite pelo menos 2 caracteres.</p>';return;}
  const resultados=todosPedidosFirebase.filter(p=>(p.cliente||'').toUpperCase().includes(q)||(p.telefone||'').includes(q));
  const unicos=[];const vistos=new Set();
  resultados.forEach(p=>{const chave=(p.cliente||'')+'|'+(p.telefone||'');if(!vistos.has(chave)){vistos.add(chave);unicos.push(p);}});
  if(unicos.length===0){container.innerHTML='<p style="font-size:12px;color:#999;text-align:center">Nenhum cliente encontrado.</p>';return;}
  unicos.slice(0,30).forEach(p=>{
    const div=document.createElement('div');div.style.cssText='padding:12px;border:1px solid #eee;border-radius:8px;margin-bottom:6px;cursor:pointer;transition:all 0.2s';
    div.innerHTML='<div style="font-weight:bold;color:var(--primary-color)">'+p.cliente+'</div><div style="font-size:12px;color:#666">📞 '+p.telefone+' | 📍 '+((p.endereco||'').substring(0,40))+'</div>';
    div.onmouseover=()=>{div.style.background='#f8f9fa';div.style.borderColor='var(--primary-color)';};
    div.onmouseout=()=>{div.style.background='#fff';div.style.borderColor='#eee';};
    div.onclick=()=>{selecionarClienteModal(p);};
    container.appendChild(div);
  });
}
function selecionarClienteModal(p){carregarParaEdicao(p);fecharBuscaCliente();mostrarMensagemSucesso("Cliente carregado! ✅");}

// Detalhes Pedido
function mostrarDetalhesPedido(p){
  const container=document.getElementById('conteudoDetalhesPedido');
  const st=(p.statusEntrega||'Pendente').trim().toUpperCase();
  const linkWaze='https://waze.com/ul?q='+encodeURIComponent(p.endereco||'');
  const linkMaps='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p.endereco||'');
  container.innerHTML='<div style="line-height:1.8">'+
    '<div class="detalhe-item"><span class="detalhe-label">👤 Cliente:</span><div class="detalhe-valor">'+p.cliente+'</div></div>'+
    '<div class="detalhe-item"><span class="detalhe-label">📞 Telefone:</span><div class="detalhe-valor">'+(p.telefone||'-')+'</div></div>'+
    '<div class="detalhe-item"><span class="detalhe-label">📍 Endereço:</span><div class="detalhe-valor">'+(p.endereco||'-')+'</div></div>'+
    '<div class="detalhe-item"><span class="detalhe-label">📦 Produto:</span><div class="detalhe-valor">'+(p.qtd>1?p.qtd+'x ':'')+(p.produto||'-')+'</div></div>'+
    '<div class="detalhe-item"><span class="detalhe-label">🛒 Canal:</span><div class="detalhe-valor">'+(p.canalVenda||'-')+'</div></div>'+
    '<div class="detalhe-item"><span class="detalhe-label">🛵 Entregador:</span><div class="detalhe-valor">'+(p.entregador||'-')+'</div></div>'+
    '<div class="detalhe-item"><span class="detalhe-label">💳 Pagamento:</span><div class="detalhe-valor">'+(p.pagamento||'-')+'</div></div>'+
    '<div class="detalhe-item"><span class="detalhe-label">💵 Valor:</span><div class="detalhe-valor" style="font-size:20px;color:var(--success-color);font-weight:700">R$ '+p.valor+'</div></div>'+
    '<div class="detalhe-item"><span class="detalhe-label">⏱️ Status:</span><div class="detalhe-valor"><span class="badge-status status-'+st.toLowerCase().replace(/\s+/g,'-')+'">'+(st==='EM ROTA'?'INICIADO':(st==='PRIORIZAR'?'PRIORIZAR':p.statusEntrega))+'</span></div></div>'+
    (p.informacoes?'<div class="detalhe-item"><span class="detalhe-label">📝 Info:</span><div class="detalhe-valor">'+p.informacoes+'</div></div>':'')+
    (p.duracaoGas?'<div class="detalhe-item"><span class="detalhe-label">⏳ Duração:</span><div class="detalhe-valor">'+p.duracaoGas+' dias</div></div>':'')+
    (p.numSeq?'<div class="detalhe-item"><span class="detalhe-label">🔢 Sequencial:</span><div class="detalhe-valor">'+p.numSeq+'</div></div>':'')+
    '<div style="display:flex;gap:8px;margin-top:15px">'+
    '<a href="'+linkWaze+'" target="_blank" class="btn-primary" style="flex:1;text-align:center;text-decoration:none;padding:10px;border-radius:12px">📍 Waze</a>'+
    '<a href="'+linkMaps+'" target="_blank" class="btn-primary" style="flex:1;text-align:center;text-decoration:none;padding:10px;border-radius:12px;background:linear-gradient(135deg,#00b8ff,#0076ff)">📍 Google Maps</a></div>';
  document.getElementById('modalDetalhesPedido').style.display='block';
}
function mostrarModalUltimoPedido(historico){
  const container=document.getElementById('conteudoUltimoPedido');
  container.innerHTML=historico.slice(0,5).map(p=>'<div style="padding:8px;border:1px solid #eee;border-radius:8px;margin-bottom:6px">'+
    '<div style="font-weight:bold;color:var(--primary-color)">'+(p.cliente||'')+'</div>'+
    '<div style="font-size:12px;color:#666">📅 '+(p.data||'')+' | 💵 R$ '+(p.valor||'')+' | 📦 '+(p.produto||'')+'</div></div>').join('');
  if(historico.length>5)container.innerHTML+='<p style="font-size:11px;color:#999;text-align:center">...e mais '+(historico.length-5)+' pedido(s)</p>';
  document.getElementById('modalUltimoPedido').style.display='block';
}
function mostrarModalTempos(p){
  const container=document.getElementById('conteudoTempos');
  const getData=v=>v||'-';
  const criado=getData(p.data);const concluido=getData(p.tempo_concluido);
  let diff='-';if(p.data&&p.tempo_concluido){try{const pd=new Date(p.data.split(/[\s,]+/).join(' '));const pc=new Date(p.tempo_concluido.split(/[\s,]+/).join(' '));const ms=pc-pd;if(!isNaN(ms)){const min=Math.floor(ms/60000);diff=min+' min';}}catch(e){}}
  container.innerHTML='<div style="line-height:2">'+
    '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee"><span style="font-weight:600">📅 Criado em:</span><span>'+criado+'</span></div>'+
    '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee"><span style="font-weight:600">✅ Concluído em:</span><span>'+concluido+'</span></div>'+
    '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;background:#e8f5e9;border-radius:8px;padding:10px;margin-top:8px"><span style="font-weight:600">⏱️ Tempo total:</span><span style="font-weight:700;color:var(--success-color);font-size:18px">'+diff+'</span></div></div>';
  document.getElementById('modalTempos').style.display='block';
}

// Foto Grande
function abrirFotoGrande(url){const img=document.getElementById('fotoGrandeImg');img.src=url;document.getElementById('modalFotoGrande').style.display='block';}
function fecharFotoGrande(){document.getElementById('modalFotoGrande').style.display='none';}

// Gráfico Canais
function gerarGraficoCanais(){
  const canais={};let total=0;
  pedidosFiltradosGlobal.filter(p=>!(p.produto||'').toLowerCase().includes('água')&&!(p.produto||'').toLowerCase().includes('agua')).forEach(p=>{const c=p.canalVenda||'OUTROS';canais[c]=(canais[c]||0)+1;total++;});
  if(total===0){alert("Nenhum pedido de gás no filtro atual.");return;}
  if(window._chartCanais)window._chartCanais.destroy();
  const ctx=document.getElementById('chartCanais');
  if(ctx)window._chartCanais=new Chart(ctx,{type:'bar',data:{labels:Object.keys(canais),datasets:[{label:'Botijões',data:Object.values(canais),backgroundColor:['#ff7675','#74b9ff','#55efc4','#fdcb6e','#a29bfe','#e17055','#00cec9','#fd79a8']}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,title:{display:true,text:'Quantidade'}}}}});
  document.getElementById('modalGraficoCanais').style.display='block';
}

// ========== SIDEBAR & TABS ==========
function toggleSidebar(){
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').style.display=document.getElementById('sidebar').classList.contains('open')?'block':'none';
}
function switchTab(tab){
  document.querySelectorAll('.tab-content').forEach(el=>el.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  document.querySelectorAll('.sidebar-nav button[data-tab]').forEach(el=>el.classList.remove('active-tab'));
  const btn=document.querySelector('.sidebar-nav button[data-tab="'+tab+'"]');if(btn)btn.classList.add('active-tab');
  toggleSidebar();
}
function configPopup(){document.getElementById('configPopup').style.display='block';}

// ========== EVENTOS ==========
function configurarEventos(){
  document.getElementById('btnGerar').addEventListener('click',gerarPedido);
  document.getElementById('btnLimpar').addEventListener('click',()=>{
    ['nome','telefone','endereco','valor','informacoes','duracaoGas'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.querySelectorAll('.secao-titulo,.btn-copiar,#resultado,#msgCliente').forEach(el=>el.style.display='none');
  });
  document.getElementById('valor').addEventListener('input',function(){mascaraMoeda(this);});
  document.getElementById('telefone').addEventListener('input',function(){mascaraTelefone(this);});
  document.getElementById('btnFiltrar').addEventListener('click',renderizarTabelaPorData);
  document.getElementById('inputBusca').addEventListener('keyup',e=>{if(e.key==='Enter')renderizarTabelaPorData();});
  document.getElementById('btnFaturamento').addEventListener('click',processarFaturamento);
  document.getElementById('btnRetencao').addEventListener('click',gerarPrevisaoRetencao);
  document.getElementById('btnExcel').addEventListener('click',exportarExcel);
  document.getElementById('btnHistoricoAnual').addEventListener('click',abrirHistoricoAnual);
  document.getElementById('btnGraficoCanais').addEventListener('click',gerarGraficoCanais);
  document.getElementById('btnCopiarEntrega').addEventListener('click',()=>copiarTextoParaClipboard(document.getElementById('resultado').innerText));
  document.getElementById('btnCopiarCliente').addEventListener('click',()=>copiarTextoParaClipboard(document.getElementById('msgCliente').innerText));
  // Close modals
  document.querySelectorAll('.modal .close').forEach(el=>{el.addEventListener('click',function(){let p=this.closest('.modal');if(p)p.style.display='none';});});
  window.addEventListener('click',e=>{if(e.target.classList.contains('modal'))e.target.style.display='none';});
  // Canal change toggles pesquisa
  document.getElementById('canalVenda').addEventListener('change',function(){
    const isPesq=this.value==='PESQUISA';
    document.getElementById('containerEntregador').style.display=isPesq?'none':'block';
    document.getElementById('containerPagamento').style.display=isPesq?'none':'block';
    document.getElementById('containerDuracao').style.display=isPesq?'none':'block';
  });
}

// ========== INIT ==========
carregarConfigImpressao();carregarConfigPromo();
document.addEventListener('DOMContentLoaded',()=>{verificarSessao();});

// ========== EXPORT FOR INLINE HTML HANDLERS ==========
// ES Module functions are not global; expose them for onclick/onkeyup attributes
window.login = login;
window.confirmarSenhaLoja = confirmarSenhaLoja;
window.cancelarLogin = cancelarLogin;
window.acessarModulo = acessarModulo;
window.adicionarEntregador = adicionarEntregador;
window.toggleSidebar = toggleSidebar;
window.switchTab = switchTab;
window.logout = logout;
window.configPopup = configPopup;
window.mudarTema = mudarTema;
window.abrirBuscaCliente = abrirBuscaCliente;
window.colarNumeroWhatsApp = colarNumeroWhatsApp;
window.toggleBlacklist = toggleBlacklist;
window.preencherPortaria = preencherPortaria;
window.copiarTextoParaClipboard = copiarTextoParaClipboard;
window.importarJSON = importarJSON;
window.exportarJSON = exportarJSON;
window.abrirModalInserirVendaRetroativa = abrirModalInserirVendaRetroativa;
window.exportarExcel = exportarExcel;
window.processarFaturamento = processarFaturamento;
window.abrirHistoricoAnualView = abrirHistoricoAnualView;
window.gerarPrevisaoRetencao = gerarPrevisaoRetencao;
window.gerarGraficoCanais = gerarGraficoCanais;
window.localizarEntregadores = localizarEntregadores;
window.exportarHistoricoAnualExcel = exportarHistoricoAnualExcel;
window.fecharModalVendaRetroativa = fecharModalVendaRetroativa;
window.salvarVendaRetroativa = salvarVendaRetroativa;
window.salvarRateioPagamentoEConferir = salvarRateioPagamentoEConferir;
window.fecharBuscaCliente = fecharBuscaCliente;
window.buscarClientesModal = buscarClientesModal;
window.fecharFotoGrande = fecharFotoGrande;
window.mostrarMensagemSucesso = mostrarMensagemSucesso;
window.mascaraMoeda = mascaraMoeda;
window.mascaraTelefone = mascaraTelefone;
window.removerEntregador = removerEntregador;
window.selecionarClienteModal = selecionarClienteModal;
window.mostrarDetalhesPedido = mostrarDetalhesPedido;
window.abrirFotoGrande = abrirFotoGrande;
window.mostrarModalUltimoPedido = mostrarModalUltimoPedido;
window.mostrarModalTempos = mostrarModalTempos;
