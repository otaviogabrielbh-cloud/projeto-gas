const fs = require('fs');

const targets = [
    'alertaproximidade.html',
    'conciliacao.html',
    'converter-ofx.html',
    'cracha.html',
    'entregador.html',
    'index.html',
    'index2.html',
    'whatsapp-config.html',
    'landing.html'
];

for (const f of targets) {
    if (!fs.existsSync(f)) continue;
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n');
    console.log(`\n================== ${f} ==================`);
    lines.forEach((line, idx) => {
        if (line.toLowerCase().includes('firebase') || line.toLowerCase().includes('gstatic') || line.toLowerCase().includes('databaseurl')) {
            console.log(`L${idx + 1}: ${line.trim().substring(0, 140)}`);
        }
    });
}
