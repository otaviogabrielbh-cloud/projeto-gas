// VPS Adapter - Canoas Gás
// Conexão em tempo real e emulação das APIs do Firebase usando Socket.IO e VPS

const socket = io('http://179.236.224.192:3000', {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
});

window.remoteDb = socket;
window.vpsSocket = socket;

// Helper para normalizar referências de caminhos
window.firebaseRef = (dbOrPath, maybePath) => {
    if (typeof maybePath === 'string') return maybePath;
    if (typeof dbOrPath === 'string') return dbOrPath;
    return '';
};

// Emulação do set()
window.firebaseSet = (pathOrRef, payload) => {
    const path = typeof pathOrRef === 'string' ? pathOrRef : '';
    return new Promise(resolve => {
        socket.emit('set', { path, payload }, resolve);
    });
};

// Emulação do push()
window.firebasePush = (pathOrRef, payload) => {
    const path = typeof pathOrRef === 'string' ? pathOrRef : '';
    const id = '-O' + Date.now().toString(16) + Math.random().toString(36).substring(2, 8);
    const fullPath = path ? `${path}/${id}` : id;
    
    const prom = new Promise(resolve => {
        if (payload !== undefined) {
            socket.emit('set', { path: fullPath, payload }, resolve);
        } else {
            resolve({ key: id });
        }
    });
    
    return { key: id, path: fullPath, then: prom.then.bind(prom), catch: prom.catch.bind(prom) };
};

// Emulação do update()
window.firebaseUpdate = (pathOrRef, payload) => {
    const path = typeof pathOrRef === 'string' ? pathOrRef : '';
    return new Promise(resolve => {
        socket.emit('update', { path, payload }, resolve);
    });
};

// Emulação do remove()
window.firebaseRemove = (pathOrRef) => {
    const path = typeof pathOrRef === 'string' ? pathOrRef : '';
    return new Promise(resolve => {
        socket.emit('remove', path, resolve);
    });
};

// Emulação do get()
window.firebaseGet = (pathOrRef) => {
    const path = typeof pathOrRef === 'string' ? pathOrRef : '';
    return new Promise(resolve => {
        socket.emit('get', { path }, (data) => {
            resolve({
                val: () => data,
                exists: () => (data !== null && data !== undefined)
            });
        });
    });
};

// Emulação do onValue() (Real-time listener)
window.firebaseOnValue = (pathOrRef, callback) => {
    const path = typeof pathOrRef === 'string' ? pathOrRef : '';
    if (!path || typeof callback !== 'function') return () => {};
    
    let col = path.split('/')[0];
    
    const fetchData = () => {
        socket.emit('get', { path }, (data) => {
            callback({
                val: () => data,
                exists: () => (data !== null && data !== undefined)
            });
        });
    };
    
    // Leitura inicial imediata
    fetchData();
    
    // Ouvir atualizações em tempo real disparadas pelo servidor
    const eventName = `changed_${col}`;
    socket.on(eventName, fetchData);
    
    // Retorna função para cancelar o listener se necessário
    return () => {
        socket.off(eventName, fetchData);
    };
};

// Emulação do onDisconnect()
window.firebaseOnDisconnect = () => ({
    remove: () => Promise.resolve(),
    set: () => Promise.resolve(),
    update: () => Promise.resolve(),
    cancel: () => Promise.resolve()
});

// Aliases globais diretos para máxima compatibilidade com módulos e scripts legados
window.ref = window.firebaseRef;
window.set = window.firebaseSet;
window.push = window.firebasePush;
window.update = window.firebaseUpdate;
window.remove = window.firebaseRemove;
window.get = window.firebaseGet;
window.onValue = window.firebaseOnValue;
window.onDisconnect = window.firebaseOnDisconnect;

console.log('✅ VPS Adapter inicializado com sucesso (Conectado a http://179.236.224.192:3000)');
