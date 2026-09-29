const { io } = require('socket.io-client');
const socket = io('http://179.236.224.192:3000');

socket.on('connect', () => {
    socket.emit('get', { path: 'equipe_entregadores' }, (data) => {
        console.log('Dados de equipe_entregadores na VPS:', data);
        process.exit(0);
    });
});
