const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

lines.forEach((l, i) => {
    if (l.includes('renderizarTabelaPorData') && l.includes('function')) {
        console.log(`Linha ${i+1}: ${l}`);
        for (let j = i; j <= i + 60; j++) {
            console.log(`  [${j+1}] ${lines[j]}`);
        }
    }
});
