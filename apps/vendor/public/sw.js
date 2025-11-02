/* eslint-env serviceworker */
const CACHE_VERSION = 'vendor-pwa-v1';
const APP_SHELL = ['/', '/manifest.webmanifest'];
const STATIC_DESTINATIONS = new Set(['style', 'script', 'image', 'font']);

function shouldCacheRequest(request, response) {
  if (!response || !response.ok) {
    return false;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return false;
  }

  if (APP_SHELL.includes(url.pathname)) {
    return true;
  }

  if (!STATIC_DESTINATIONS.has(request.destination)) {
    return false;
  }

  const cacheControl = response.headers.get('Cache-Control');
  if (cacheControl && /no-store|no-cache|private/i.test(cacheControl)) {
    return false;
  }

  return true;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch((error) => {
      console.error('Pre-cache failed', error);
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .catch((error) => console.error('Cache cleanup failed', error)),
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  if (url.origin === self.location.origin && APP_SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(event.request));
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(event.request);
        if (shouldCacheRequest(event.request, networkResponse)) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        const cache = await caches.open(CACHE_VERSION);
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        if (event.request.mode === 'navigate') {
          const fallback = await cache.match('/');
          if (fallback) {
            return fallback;
          }
        }

        throw error;
      }
    })(),
  );
});
