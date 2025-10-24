/// <reference lib="webworker" />

const serviceWorker = self as unknown as ServiceWorkerGlobalScope;

type PrecacheEntry = {
  url: string;
  revision: string;
};

const BUILD_VERSION = "__BUILD_VERSION__";

const STATIC_CACHE = `static-${BUILD_VERSION}`;
const API_CACHE = `api-${BUILD_VERSION}`;
const INVENTORY_CACHE = `inventory-${BUILD_VERSION}`;

const PRECACHE_MANIFEST = /* __PRECACHE_MANIFEST__ */ [] as readonly PrecacheEntry[];
const PRECACHE_URLS = Array.from(
  new Set(["/", ...PRECACHE_MANIFEST.map((entry) => entry.url)]),
);
const PRECACHE_URL_SET = new Set(PRECACHE_URLS);
const PRECACHE_REVISION_MAP = new Map(
  PRECACHE_MANIFEST.map((entry) => [entry.url, entry.revision] as const),
);
const RUNTIME_CACHES = [STATIC_CACHE, API_CACHE, INVENTORY_CACHE];

serviceWorker.addEventListener("install", (event) => {
  const swEvent = event as ExtendableEvent;
  serviceWorker.skipWaiting();
  swEvent.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          const request = new Request(url, { cache: "reload" });
          const response = await fetch(request);
          const pathname = new URL(request.url).pathname;
          const revision =
            PRECACHE_REVISION_MAP.get(pathname) ??
            (pathname === "/" ? BUILD_VERSION : undefined);
          await cache.put(request, stamp(response, { revision }));
        }),
      );
    })(),
  );
});

serviceWorker.addEventListener("activate", (event) => {
  const swEvent = event as ExtendableEvent;
  swEvent.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !RUNTIME_CACHES.includes(key))
          .map((key) => caches.delete(key)),
      );

      const staticCache = await caches.open(STATIC_CACHE);
      const cachedRequests = await staticCache.keys();
      await Promise.all(
        cachedRequests.map(async (request) => {
          const pathname = new URL(request.url).pathname;
          if (!PRECACHE_URL_SET.has(pathname)) {
            await staticCache.delete(request);
            return;
          }

          const expectedRevision =
            PRECACHE_REVISION_MAP.get(pathname) ??
            (pathname === "/" ? BUILD_VERSION : undefined);
          if (!expectedRevision) {
            return;
          }

          const cachedResponse = await staticCache.match(request);
          const cachedRevision = cachedResponse?.headers.get("sw-revision");
          if (cachedRevision !== expectedRevision) {
            await staticCache.delete(request);
          }
        }),
      );

      await serviceWorker.clients.claim();
    })(),
  );
});

serviceWorker.addEventListener("fetch", (event) => {
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

type StampMetadata = {
  revision?: string;
};

function stamp(response: Response, metadata?: StampMetadata) {
  const clone = response.clone();
  const headers = new Headers(clone.headers);
  headers.set("sw-fetched-at", Date.now().toString());
  if (metadata?.revision) {
    headers.set("sw-revision", metadata.revision);
  }
  return new Response(clone.body, {
    status: clone.status,
    statusText: clone.statusText,
    headers,
  });
}

self.addEventListener("push", (event) => {
  const pushEvent = event as PushEvent;
  let payload: Record<string, unknown> = {};
  try {
    payload = pushEvent.data?.json?.() ?? {};
  } catch (_error) {
    payload = { title: "ecoTrips alert", body: pushEvent.data?.text?.() ?? "" };
  }
  const title = typeof payload.title === "string" ? payload.title : "ecoTrips";
  const body = typeof payload.body === "string" ? payload.body : "Offline push demo";
  pushEvent.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: payload,
      tag: typeof payload.tag === "string" ? payload.tag : undefined,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const notificationEvent = event as NotificationEvent;
  notificationEvent.notification.close();
  notificationEvent.waitUntil(
    clients.openWindow((notificationEvent.notification.data as { url?: string })?.url ?? "/support"),
  );
});
