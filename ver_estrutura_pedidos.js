const { io } = require('socket.io-client');
const socket = io('http://179.236.224.192:3000');

socket.on('connect', () => {
    socket.emit('get', { path: 'pedidos_realtime', limit: 5 }, (data) => {
        console.log('Exemplo de pedidos_realtime na VPS:', Object.keys(data || {}).slice(0, 5));
        if (data) {
            const firstKey = Object.keys(data)[0];
            console.log('Primeiro registro:', firstKey, data[firstKey]);
        }
        process.exit(0);
    });
});
