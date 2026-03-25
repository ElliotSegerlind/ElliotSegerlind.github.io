const CACHE_NAME = 'utgifter-v6';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network-first for HTML pages so updates show immediately
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp.status === 200) {
          const c = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, c));
        }
        return resp;
      }).catch(() => caches.match(e.request).then(r => r || new Response('Offline', { status: 503 })))
    );
    return;
  }
  // Cache-first for other assets
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      if (resp.status === 200) {
        const c = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, c));
      }
      return resp;
    }).catch(() => new Response('Offline', { status: 503 })))
  );
});
