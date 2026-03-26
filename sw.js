const CACHE_VERSION = 'v2';
const STATIC_CACHE = `utgifter-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `utgifter-runtime-${CACHE_VERSION}`;
const APP_SHELL = ['./', './index.html', './manifest.json'];

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

async function precacheAppShell() {
  const cache = await caches.open(STATIC_CACHE);
  await Promise.all(
    APP_SHELL.map(async url => {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch {}
    })
  );
}

self.addEventListener('install', event => {
  event.waitUntil(precacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request) {
  const runtime = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      runtime.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (isNavigationRequest(request)) {
      return (await caches.match('./index.html')) || (await caches.match('./'));
    }
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const runtime = await caches.open(RUNTIME_CACHE);
  const cached = await caches.match(request);
  const networkPromise = fetch(request)
    .then(response => {
      if (response && response.ok) {
        runtime.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) return cached;

  const response = await networkPromise;
  if (response) return response;

  if (isNavigationRequest(request)) {
    return (await caches.match('./index.html')) || (await caches.match('./'));
  }

  return new Response('', { status: 503, statusText: 'Offline' });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;
  const shellLikeRequest =
    sameOrigin &&
    (url.pathname === '/' ||
      url.pathname.endsWith('/index.html') ||
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('/manifest.json'));

  if (isNavigationRequest(event.request) || shellLikeRequest) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request));
});
