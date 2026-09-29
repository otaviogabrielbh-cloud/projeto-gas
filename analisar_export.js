const fs = require('fs');
const data = JSON.parse(fs.readFileSync('canoas-gas-default-rtdb-export.json', 'utf8'));

const keys = Object.keys(data);
console.log('Total de chaves de topo no JSON:', keys.length);

let numericKeys = 0;
let phoneKeys = 0;
let otherKeys = [];

for (const k of keys) {
    if (/^\d{1,5}$/.test(k)) {
        numericKeys++;
    } else if (/^\d{8,15}$/.test(k)) {
        phoneKeys++;
    } else {
        otherKeys.push(k);
    }
}

console.log('Chaves numéricas pequenas (ex: pedidos/arquivados):', numericKeys);
console.log('Chaves tipo telefone (clientes):', phoneKeys);
console.log('Outras chaves:', otherKeys);
