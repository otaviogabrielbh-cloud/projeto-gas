const fs = require('fs');
const { io } = require('socket.io-client');
const data = JSON.parse(fs.readFileSync('canoas-gas-default-rtdb-export.json', 'utf8'));
const socket = io('http://179.236.224.192:3000');

socket.on('connect', async () => {
    socket.emit('get', { path: 'clientes_arquivados' }, async (vpsData) => {
        const vpsKeys = new Set(Object.keys(vpsData || {}));
        const missing = Object.keys(data).filter(k => !vpsKeys.has(k));
        console.log('Total no JSON:', Object.keys(data).length);
        console.log('Total na VPS:', vpsKeys.size);
        console.log('Faltando enviar:', missing.length);
        
        for (const k of missing) {
            await new Promise(r => socket.emit('set', { path: 'clientes_arquivados/' + k, payload: data[k] }, r));
        }
        
        socket.emit('get', { path: 'clientes_arquivados' }, (finalData) => {
            console.log('Total final confirmado na VPS:', Object.keys(finalData || {}).length);
            process.exit(0);
        });
    });
});
