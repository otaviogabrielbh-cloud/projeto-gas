const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));

const socketScripts = `    <!-- VPS Socket.IO & Adapter (Primeiros Scripts) -->
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <script src="js/vps-adapter.js"></script>`;

for (const f of files) {
    let content = fs.readFileSync(f, 'utf8');
    
    // Remove ocorrências soltas
    content = content.replace(/<script\s+src=["']https:\/\/cdn\.socket\.io\/[^"']*["']><\/script>\s*/gi, '');
    content = content.replace(/<script\s+src=["']js\/vps-adapter\.js["']><\/script>\s*/gi, '');
    
    // Insere no <head>
    if (content.includes('</head>')) {
        content = content.replace('</head>', `${socketScripts}\n</head>`);
    } else if (content.includes('<body')) {
        content = content.replace('<body', `${socketScripts}\n<body`);
    }
    
    fs.writeFileSync(f, content, 'utf8');
    console.log(`✅ ${f}: Socket.io e VPS-Adapter posicionados no <head> com sucesso.`);
}
