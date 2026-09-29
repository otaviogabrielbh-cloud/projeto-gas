const { io } = require('socket.io-client');
const socket = io('http://179.236.224.192:3000');

socket.on('connect', () => {
    // 1. Get com limit 500
    socket.emit('get', { path: 'pedidos_realtime', limit: 500 }, (data500) => {
        const keys500 = Object.keys(data500 || {});
        console.log('Total retornado com limit 500:', keys500.length);
        
        const pedidosHoje500 = Object.values(data500 || {}).filter(p => p.data && p.data.includes('29/09/2026'));
        console.log('Pedidos de 29/09/2026 encontrados no limit 500:', pedidosHoje500.length);

        // 2. Get sem limit
        socket.emit('get', { path: 'pedidos_realtime' }, (dataAll) => {
            const keysAll = Object.keys(dataAll || {});
            console.log('Total retornado sem limit:', keysAll.length);
            
            const pedidosHojeAll = Object.values(dataAll || {}).filter(p => p.data && p.data.includes('29/09/2026'));
            console.log('Pedidos de 29/09/2026 encontrados sem limit:', pedidosHojeAll.length);
            
            if (pedidosHojeAll.length > 0) {
                console.log('Exemplo de pedido de hoje:', pedidosHojeAll[0]);
            }
            
            process.exit(0);
        });
    });
});
