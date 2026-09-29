const { io } = require('socket.io-client');
const socket = io('http://179.236.224.192:3000');

socket.on('connect', () => {
    socket.emit('get', { path: 'pedidos_realtime' }, (data) => {
        const list = Object.values(data || {});
        console.log('Total de pedidos_realtime na VPS:', list.length);
        
        const datas = list.map(p => (p.data || '').split(',')[0].trim()).filter(Boolean);
        const datasUnicas = [...new Set(datas)];
        console.log('Total de datas diferentes:', datasUnicas.length);
        console.log('Últimas 10 datas cadastradas:', datasUnicas.slice(-10));
        process.exit(0);
    });
});
