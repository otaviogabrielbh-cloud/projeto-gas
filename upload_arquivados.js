const fs = require('fs');
const { io } = require('socket.io-client');

const VPS_URL = 'http://179.236.224.192:3000';
const data = JSON.parse(fs.readFileSync('canoas-gas-default-rtdb-export.json', 'utf8'));

const socket = io(VPS_URL);

socket.on('connect', async () => {
    console.log('🔗 Conectado na VPS. Iniciando upload...');
    const keys = Object.keys(data);
    let count = 0;
    for (const key of keys) {
        const payload = data[key];
        await new Promise(resolve => {
            socket.emit('set', { path: `clientes_arquivados/${key}`, payload }, () => {
                resolve();
            });
        });
        count++;
        if (count % 50 === 0) console.log(`Enviados ${count} de ${keys.length}...`);
    }
    console.log(`✅ Upload finalizado! ${count} clientes_arquivados enviados.`);
    process.exit(0);
});
