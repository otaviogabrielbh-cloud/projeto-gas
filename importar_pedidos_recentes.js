const fs = require('fs');
const { io } = require('socket.io-client');

console.log('📖 Lendo pedidos_recentes.json...');
const pedidos = JSON.parse(fs.readFileSync('pedidos_recentes.json', 'utf8'));
console.log(`Total de pedidos a importar: ${pedidos.length}`);

const VPS_URL = 'http://179.236.224.192:3000';
const socket = io(VPS_URL);

socket.on('connect', async () => {
    console.log('✅ Conectado na VPS!');
    
    let count = 0;
    for (const p of pedidos) {
        const key = p.id ? String(p.id) : ('P_' + (p.timestamp || Date.now()));
        await new Promise(resolve => {
            socket.emit('set', { path: `pedidos_realtime/${key}`, payload: p }, resolve);
        });
        count++;
        if (count % 25 === 0 || count === pedidos.length) {
            console.log(`Importados: ${count}/${pedidos.length}`);
        }
    }
    
    console.log(`\n🎉 Todos os ${count} pedidos foram importados para a VPS com sucesso!`);
    process.exit(0);
});

socket.on('connect_error', (err) => {
    console.error('❌ Erro de conexão:', err.message);
    process.exit(1);
});
