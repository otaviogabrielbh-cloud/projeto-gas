const https = require('https');
const { io } = require('socket.io-client');

const FIREBASE_URL = 'https://canoas-gas-default-rtdb.firebaseio.com/clientes_arquivados.json';
const VPS_URL = 'http://179.236.224.192:3000';

async function fetchFirebase(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function start() {
    console.log('🔗 Conectando na VPS...');
    const socket = io(VPS_URL);
    
    socket.on('connect', async () => {
        console.log('✅ Conectado na VPS! Buscando clientes arquivados no Firebase...');
        try {
            const arquivados = await fetchFirebase(FIREBASE_URL);
            if (!arquivados) {
                console.log('Nenhum cliente arquivado encontrado ou acesso negado no Firebase.');
                process.exit(0);
            }
            
            const keys = Object.keys(arquivados);
            console.log(`📦 Encontrados ${keys.length} clientes arquivados.`);
            
            for (const key of keys) {
                const payload = arquivados[key];
                await new Promise(resolve => {
                    socket.emit('set', { path: `clientes_arquivados/${key}`, payload }, () => {
                        resolve();
                    });
                });
                console.log(`✔️ Cliente arquivado migrado: ${key}`);
            }
            
            console.log('🚀 Migração de clientes arquivados concluída!');
            process.exit(0);
        } catch (e) {
            console.error('❌ Erro durante a migração:', e);
            process.exit(1);
        }
    });
}

start();
