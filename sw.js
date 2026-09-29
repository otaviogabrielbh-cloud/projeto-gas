const CACHE_NAME = 'canoas-gas-v31';
const ASSETS_TO_CACHE = [
    './index.html',
    './entregador.html',
    './mapadeentregas.html',
    './alertaproximidade.html',
    './cracha.html',
    './js/entregador.js',
    './style.css',
    './mobile-cards.css',
    './manifest.json',
    './buzina.mp3',
    './logo.png',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// SW puro para Cache e Notificações Locais disparadas pela aplicação

self.addEventListener('install', (event) => {
    console.log("👷 SW: Instalando versão v28...");
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log("👷 SW: v22 Ativado.");
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim();
});

self.addEventListener('message', (event) => {
    console.log("📨 SW v17 Message:", event.data);

    if (event.data && event.data.type === 'NOTIFICAR_PEDIDO') {
        const options = {
            body: event.data.body || '🚨 NOVO PEDIDO! Toque para abrir.',
            icon: 'logo.png',
            badge: 'logo.png',
            vibrate: [2000, 200, 2000, 200, 2000, 200, 2000],
            tag: 'novo-pedido-' + Date.now(),
            renotify: true,
            requireInteraction: true,
            silent: true,
            data: { url: event.data.url || './entregador.html' }
        };

        event.waitUntil(
            self.registration.showNotification('🛵 NOVO PEDIDO!', options)
        );
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) { client = clientList[i]; }
                }
                return client.focus();
            }
            return clients.openWindow(event.notification.data.url || './entregador.html');
        })
    );
});
