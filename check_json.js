const fs = require('fs');
const data = JSON.parse(fs.readFileSync('canoas-gas-default-rtdb-export.json', 'utf8'));
console.log('Root keys:', Object.keys(data).slice(0, 10));
if (data.clientes_arquivados) {
    console.log('clientes_arquivados found. Number of items:', Object.keys(data.clientes_arquivados).length);
} else {
    console.log('No clientes_arquivados key found. Data might be the node itself.');
}
