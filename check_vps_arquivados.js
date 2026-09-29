const { io } = require('socket.io-client');
const VPS_URL = 'http://179.236.224.192:3000';
const socket = io(VPS_URL);
socket.on('connect', () => {
    socket.emit('get', { path: 'clientes_arquivados' }, (data) => {
        if (!data) {
            console.log('VPS has no clientes_arquivados.');
        } else {
            console.log('VPS has clientes_arquivados. Count:', Object.keys(data).length);
        }
        process.exit(0);
    });
});
