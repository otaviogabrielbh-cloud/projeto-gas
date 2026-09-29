const fs = require('fs');
const { io } = require('socket.io-client');

console.log('📖 Lendo canoas-gas-default-rtdb-export.json...');
const data = JSON.parse(fs.readFileSync('canoas-gas-default-rtdb-export.json', 'utf8'));
const pedidos = data.pedidos_realtime || {};
const keys = Object.keys(pedidos);

console.log(`🚀 Total de pedidos para importar: ${keys.length}`);

const VPS_URL = 'http://179.236.224.192:3000';
const socket = io(VPS_URL);

socket.on('connect', async () => {
    console.log('✅ Conectado na VPS! Iniciando envio...');
    
    // Inverter para mandar os mais recentes primeiro (Setembro de 2026 primeiro!)
    const reversedKeys = [...keys].reverse();
    
    const BATCH_SIZE = 50;
    let count = 0;
    
    for (let i = 0; i < reversedKeys.length; i += BATCH_SIZE) {
        const slice = reversedKeys.slice(i, i + BATCH_SIZE);
        const promises = slice.map(k => new Promise(resolve => {
            socket.emit('set', { path: `pedidos_realtime/${k}`, payload: pedidos[k] }, resolve);
        }));
        await Promise.all(promises);
        count += slice.length;
        if (count % 250 === 0 || count === reversedKeys.length) {
            console.log(`Progresso: ${count}/${reversedKeys.length} pedidos enviados.`);
        }
    }
    
    console.log(`\n🎉 Todos os ${count} pedidos (inclusive os de hoje) foram importados com sucesso!`);
    process.exit(0);
});

socket.on('connect_error', (err) => {
    console.error('❌ Erro de conexão:', err.message);
    process.exit(1);
});
