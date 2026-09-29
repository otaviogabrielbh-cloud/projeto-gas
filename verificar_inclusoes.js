const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));

console.log('=== VERIFICAÇÃO DE INCLUSÃO DO VPS-ADAPTER ===\n');

for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    const hasSocketIo = content.includes('socket.io');
    const hasVpsAdapter = content.includes('vps-adapter.js');
    
    console.log(`${f}: Socket.io = ${hasSocketIo}, VPS-Adapter = ${hasVpsAdapter}`);
}
