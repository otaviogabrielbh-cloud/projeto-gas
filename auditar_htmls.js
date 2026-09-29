const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));

console.log('=== AUDITORIA DE ARQUIVOS HTML ===');
for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    const hasFirebase = content.includes('firebase') || content.includes('gstatic.com');
    const hasVpsAdapter = content.includes('vps-adapter.js');
    const hasSocketIo = content.includes('socket.io');
    
    // Ver padrão de imports
    const moduleScriptMatch = content.match(/<script\s+type=["']module["'][^>]*>([\s\S]*?)<\/script>/i);
    const regularScriptCount = (content.match(/<script(?!\s+type=["']module["'])[^>]*>/gi) || []).length;
    
    console.log(`\n📄 ${f}:`);
    console.log(`  - Tem Firebase SDK: ${hasFirebase}`);
    console.log(`  - Tem VPS Adapter: ${hasVpsAdapter}`);
    console.log(`  - Tem Socket.IO: ${hasSocketIo}`);
    console.log(`  - Script type="module": ${!!moduleScriptMatch}`);
    console.log(`  - Outras tags <script>: ${regularScriptCount}`);
}
