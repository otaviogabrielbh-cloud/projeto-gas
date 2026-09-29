const fs = require('fs');
const { io } = require('socket.io-client');

console.log('📖 Lendo canoas-gas-default-rtdb-export.json...');
const data = JSON.parse(fs.readFileSync('canoas-gas-default-rtdb-export.json', 'utf8'));

const VPS_URL = 'http://179.236.224.192:3000';
const socket = io(VPS_URL);

socket.on('connect', async () => {
    console.log('✅ Conectado na VPS!');
    
    // 1. Separar chaves numéricas (clientes_arquivados)
    const topKeys = Object.keys(data);
    const numericKeys = topKeys.filter(k => /^\d+$/.test(k));
    const namedCollections = topKeys.filter(k => !/^\d+$/.test(k));
    
    console.log(`📦 Encontradas ${numericKeys.length} entradas de pedidos/clientes arquivados.`);
    console.log(`📦 Encontradas ${namedCollections.length} coleções do sistema:`, namedCollections);

    // Migrar clientes_arquivados
    console.log('\n--- 🚀 Migrando Clientes/Pedidos Arquivados ---');
    let countArq = 0;
    for (const key of numericKeys) {
        const payload = data[key];
        await new Promise(resolve => {
            socket.emit('set', { path: `clientes_arquivados/${key}`, payload }, resolve);
        });
        countArq++;
        if (countArq % 50 === 0 || countArq === numericKeys.length) {
            console.log(`Clientes arquivados: ${countArq}/${numericKeys.length}`);
        }
    }

    // Migrar coleções nomeadas
    for (const col of namedCollections) {
        console.log(`\n--- 🚀 Migrando coleção: ${col} ---`);
        const colData = data[col];
        
        if (colData && typeof colData === 'object' && !Array.isArray(colData)) {
            const subKeys = Object.keys(colData);
            let subCount = 0;
            for (const subKey of subKeys) {
                const payload = colData[subKey];
                await new Promise(resolve => {
                    socket.emit('set', { path: `${col}/${subKey}`, payload }, resolve);
                });
                subCount++;
                if (subCount % 100 === 0 || subCount === subKeys.length) {
                    console.log(`  ${col}: ${subCount}/${subKeys.length}`);
                }
            }
        } else {
            // Objeto direto ou array simples
            await new Promise(resolve => {
                socket.emit('set', { path: col, payload: colData }, resolve);
            });
            console.log(`  ${col}: migrado como valor direto.`);
        }
    }

    console.log('\n🎉 MIGRAÇÃO 100% CONCLUÍDA COM SUCESSO NA VPS!');
    process.exit(0);
});

socket.on('connect_error', (err) => {
    console.error('❌ Erro de conexão com a VPS:', err.message);
    process.exit(1);
});
