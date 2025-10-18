/// <reference lib="webworker" />

const STATIC_CACHE = "static-v1";
const API_CACHE = "api-v1";
const INVENTORY_CACHE = "inventory-v1";

self.addEventListener("install", (event) => {
  const swEvent = event as ExtendableEvent;
  swEvent.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(["/", "/manifest.json"]),
    ),
  );
});

self.addEventListener("activate", (event) => {
  const swEvent = event as ExtendableEvent;
  swEvent.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![STATIC_CACHE, API_CACHE, INVENTORY_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      ),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const fetchEvent = event as FetchEvent;
  const request = fetchEvent.request;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (url.pathname.startsWith("/functions/v1/inventory-search")) {
    fetchEvent.respondWith(cacheFirst(fetchEvent.request, INVENTORY_CACHE, 600_000));
    return;
  }

  if (url.pathname.startsWith("/functions/v1/")) {
    fetchEvent.respondWith(networkFirst(fetchEvent.request, API_CACHE));
    return;
  }

  fetchEvent.respondWith(staleWhileRevalidate(fetchEvent.request, STATIC_CACHE));
});

async function cacheFirst(request: Request, cacheName: string, maxAgeMs: number) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    const dateHeader = cached.headers.get("sw-fetched-at");
    if (dateHeader && Date.now() - Number(dateHeader) < maxAgeMs) {
      return cached;
    }
  }
  const response = await fetch(request);
  cache.put(request, stamp(response));
  return response;
}

async function networkFirst(request: Request, cacheName: string) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    cache.put(request, stamp(response));
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request: Request, cacheName: string) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then((response) => {
    cache.put(request, stamp(response));
    return response;
  });
  return cached || networkPromise;
}

function stamp(response: Response) {
  const clone = response.clone();
  const headers = new Headers(clone.headers);
  headers.set("sw-fetched-at", Date.now().toString());
  return new Response(clone.body, {
    status: clone.status,
    statusText: clone.statusText,
    headers,
  });
}
