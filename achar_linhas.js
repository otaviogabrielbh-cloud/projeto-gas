const fs = require('fs');

['index.html', 'index2.html'].forEach(filename => {
    console.log(`=== ${filename} ===`);
    const lines = fs.readFileSync(filename, 'utf8').split('\n');
    lines.forEach((l, i) => {
        if (l.includes('<script type="module">') || l.includes('// --- FIREBASE CONFIG ---')) {
            console.log(`Linha ${i+1}: ${l}`);
            for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 15); j++) {
                console.log(`  [${j+1}] ${lines[j]}`);
            }
        }
    });
});
