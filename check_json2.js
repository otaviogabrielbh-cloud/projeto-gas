const fs = require('fs');
const data = JSON.parse(fs.readFileSync('canoas-gas-default-rtdb-export.json', 'utf8'));
console.log('Total items:', Object.keys(data).length);
console.log('Is Array?', Array.isArray(data));
