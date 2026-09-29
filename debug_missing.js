const fs = require('fs');
const { io } = require('socket.io-client');
const data = JSON.parse(fs.readFileSync('canoas-gas-default-rtdb-export.json', 'utf8'));
const socket = io('http://179.236.224.192:3000');

socket.on('connect', () => {
    socket.emit('get', { path: 'clientes_arquivados' }, (vpsData) => {
        const vpsKeys = new Set(Object.keys(vpsData || {}));
        const missing = Object.keys(data).filter(k => !vpsKeys.has(k));
        console.log('Chaves faltando:', missing);
        if (missing.length > 0) {
            console.log('Exemplo de chave faltando:', missing[0], data[missing[0]]);
        }
        process.exit(0);
    });
});
