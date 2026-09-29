const fs = require('fs');
const { io } = require('socket.io-client');

const data = JSON.parse(fs.readFileSync('canoas-gas-default-rtdb-export.json', 'utf8'));
const pedidos = data.pedidos_realtime || {};
const allKeys = Object.keys(pedidos);

const socket = io('http://179.236.224.192:3000');

socket.on('connect', () => {
    socket.emit('get', { path: 'pedidos_realtime' }, async (vpsData) => {
        const vpsKeys = new Set(Object.keys(vpsData || {}));
        const missing = allKeys.filter(k => !vpsKeys.has(k));
        console.log(`Total no JSON: ${allKeys.length} | Na VPS: ${vpsKeys.size} | Faltando: ${missing.length}`);
        
        if (missing.length === 0) {
            console.log('✅ VPS já está com 100% dos pedidos sincronizados!');
            process.exit(0);
        }
        
        const BATCH = 50;
        let count = 0;
        for (let i = 0; i < missing.length; i += BATCH) {
            const chunk = missing.slice(i, i + BATCH);
            await Promise.all(chunk.map(k => new Promise(res => {
                socket.emit('set', { path: `pedidos_realtime/${k}`, payload: pedidos[k] }, res);
            })));
            count += chunk.length;
            if (count % 500 === 0 || count === missing.length) {
                console.log(`Sincronizados ${count}/${missing.length} restantes...`);
            }
        }
        
        console.log('🎉 Sincronização de todos os pedidos finalizada com sucesso!');
        process.exit(0);
    });
});
