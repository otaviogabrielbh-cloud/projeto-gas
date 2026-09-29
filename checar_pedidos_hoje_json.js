const fs = require('fs');
const data = JSON.parse(fs.readFileSync('canoas-gas-default-rtdb-export.json', 'utf8'));

const pedidos = data.pedidos_realtime || {};
const keys = Object.keys(pedidos);
console.log('Total de pedidos_realtime no JSON exportado:', keys.length);

const pedidosHoje = [];
for (const k of keys) {
    const p = pedidos[k];
    if (p && p.data && p.data.includes('29/09/2026')) {
        pedidosHoje.push({ key: k, ...p });
    }
}

console.log('Pedidos de hoje (29/09/2026) encontrados no JSON:', pedidosHoje.length);
if (pedidosHoje.length > 0) {
    console.log('Exemplo de pedido de hoje no JSON:', pedidosHoje[0]);
}
