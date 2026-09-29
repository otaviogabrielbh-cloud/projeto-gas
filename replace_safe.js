const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && !f.includes('bak'));

const adapterScript = `\n<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>\n<script src="js/vps-adapter.js"></script>\n`;

let affectedFiles = 0;

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Let's replace the Firebase import block
    // Pattern to match from `import { initializeApp` until `const app = initializeApp(firebaseConfig);` and `const remoteDb = getDatabase(app);` and `window.remoteDb = remoteDb;`
    
    // Simpler approach: find the exact script tag where Firebase is imported
    // In all other files except index.html/index2.html, Firebase might be imported via module or via normal script tags.
    // Wait, earlier I saw entregador.html did NOT have `import { initializeApp }`!
    // Let's check how entregador.html imported Firebase.
    
    // But first, let's just do a blanket regex to remove any script src containing firebase, 
    // and any import containing firebase.
});
