const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && !f.includes('bak'));

const adapterScript = `<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>\n<script src="js/vps-adapter.js"></script>`;

let affectedFiles = 0;

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Remove old Firebase config module and insert our adapter script instead.
    const startTag = '<script type="module">';
    const firebaseStart = content.indexOf('import { initializeApp');
    
    if (firebaseStart !== -1) {
        const moduleStart = content.lastIndexOf(startTag, firebaseStart);
        if (moduleStart !== -1) {
            // Find the end of this script block
            const endTag = '</script>';
            const moduleEnd = content.indexOf(endTag, firebaseStart);
            if (moduleEnd !== -1) {
                // Extract the block to see what else is in it
                const scriptBlock = content.substring(moduleStart, moduleEnd + endTag.length);
                
                // Does it have custom logic outside of Firebase mapping?
                // Most likely it maps firebase to window.firebaseRef etc.
                // We will replace this entire block with our adapter
                content = content.substring(0, moduleStart) + '\n' + adapterScript + '\n' + content.substring(moduleEnd + endTag.length);
                fs.writeFileSync(filePath, content, 'utf-8');
                console.log(`Atualizado: ${file}`);
                affectedFiles++;
            }
        }
    }
});

console.log(`Substituicao finalizada! ${affectedFiles} arquivos alterados.`);
