/// <reference lib="webworker" />
/// <reference lib="es2017" />

import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, setDefaultHandler, setCatchHandler } from "workbox-routing";
import {
  NetworkFirst,
  NetworkOnly,
  CacheFirst,
  StaleWhileRevalidate,
} from "workbox-strategies";
import { BackgroundSyncPlugin } from "workbox-background-sync";
import { ExpirationPlugin } from "workbox-expiration";

declare let self: ServiceWorkerGlobalScope;

type ManifestEntry = { url: string; revision?: string };
const manifest = (self.__WB_MANIFEST as Array<ManifestEntry> | undefined) ?? [];
const FALLBACK_URL = "/offline.html";

const SUPABASE_ORIGIN = (() => {
  try {
    const value = (import.meta as { env?: Record<string, string | undefined> })?.env?.
      VITE_SUPABASE_URL;
    return value ? new URL(value).origin : null;
  } catch (_error) {
    return null;
  }
})();

const SYNC_COMPLETE_MESSAGE = "icupa-sync-complete";

interface SyncBroadcastPayload {
  replayedCount: number;
  firstQueuedAt?: number | null;
  replayStartedAt?: number | null;
  replayCompletedAt?: number | null;
  queuedDurationMs?: number | null;
  replayLatencyMs?: number | null;
  hadError?: boolean;
  batchId?: string | null;
}

function generateBatchId(): string {
  if (typeof self.crypto !== "undefined" && typeof self.crypto.randomUUID === "function") {
    return self.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function broadcastSyncComplete(payload: SyncBroadcastPayload): Promise<void> {
  if (payload.replayedCount <= 0) {
    return;
  }

  const clientList = await self.clients.matchAll({
    includeUncontrolled: true,
    type: "window",
  });

  await Promise.all(
    clientList.map((client) =>
      client.postMessage({
        type: SYNC_COMPLETE_MESSAGE,
        ...payload,
      })
    ),
  );
}

self.skipWaiting();
clientsClaim();

precacheAndRoute([...manifest, { url: FALLBACK_URL }]);
cleanupOutdatedCaches();

setDefaultHandler(
  new NetworkFirst({
    cacheName: "icupa-pages",
    networkTimeoutSeconds: 5,
  })
);

const offlineFallbackHandler = createHandlerBoundToURL(FALLBACK_URL);

setCatchHandler(async ({ event }) => {
  if (event.request.mode === "navigate") {
    try {
      return await offlineFallbackHandler({ event } as never);
    } catch (_error) {
      const cache = await caches.open("icupa-pages");
      const cachedResponse = await cache.match(FALLBACK_URL);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
  }

  return Response.error();
});

registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: "icupa-images",
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
);

registerRoute(
  ({ url }) =>
    url.pathname.startsWith("/menus") ||
    url.pathname.includes("/rest/v1/menu") ||
    url.pathname.includes("/rest/v1/items"),
  new StaleWhileRevalidate({
    cacheName: "icupa-menus",
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 })],
  })
);

const backgroundSyncQueueName = "icupa-api-queue";

const backgroundSync = new BackgroundSyncPlugin(backgroundSyncQueueName, {
  maxRetentionTime: 60,
  onSync: async ({ queue }) => {
    const entries = await queue.getAll();
    if (entries.length === 0) {
      return;
    }

    const replayStartedAt = Date.now();
    const batchId = generateBatchId();

    const firstQueuedAt = entries.reduce<number | null>((earliest, entry) => {
      if (typeof entry.timestamp !== "number") {
        return earliest;
      }
      if (earliest === null || entry.timestamp < earliest) {
        return entry.timestamp;
      }
      return earliest;
    }, null);

    const broadcastResult = async (replayedCount: number, hadError: boolean, completedAt: number) => {
      const queuedDurationMs =
        firstQueuedAt !== null ? Math.max(0, completedAt - firstQueuedAt) : null;
      const replayLatencyMs = Math.max(0, completedAt - replayStartedAt);

      await broadcastSyncComplete({
        replayedCount,
        firstQueuedAt,
        replayStartedAt,
        replayCompletedAt: completedAt,
        queuedDurationMs,
        replayLatencyMs,
        hadError,
        batchId,
      });
    };

    let replayedCount = 0;
    let hadError = false;

    try {
      await queue.replayRequests();
      replayedCount = entries.length;
    } catch (error) {
      hadError = true;
      const remaining = await queue.getAll();
      replayedCount = Math.max(0, entries.length - remaining.length);
      const replayCompletedAt = Date.now();
      await broadcastResult(replayedCount, hadError, replayCompletedAt);
      throw error;
    }

    const replayCompletedAt = Date.now();
    await broadcastResult(replayedCount, hadError, replayCompletedAt);
  },
});

registerRoute(
  ({ url, request }) => {
    if (request.method !== "GET") return false;
    if (url.origin === self.location.origin && url.pathname.startsWith("/api")) {
      return true;
    }
    if (SUPABASE_ORIGIN && url.origin === SUPABASE_ORIGIN && url.pathname.includes("/rest/v1")) {
      return true;
    }
    return false;
  },
  new NetworkFirst({
    cacheName: "icupa-api",
    networkTimeoutSeconds: 5,
  })
);

registerRoute(
  ({ url, request }) => {
    if (request.method !== "POST") return false;
    if (url.origin === self.location.origin && url.pathname.startsWith("/api")) {
      return true;
    }
    if (SUPABASE_ORIGIN && url.origin === SUPABASE_ORIGIN) {
      return url.pathname.includes("/rest/v1") || url.pathname.includes("/functions/v1");
    }
    return false;
  },
  new NetworkOnly({
    plugins: [backgroundSync],
  }),
  "POST"
);

registerRoute(
  ({ url, request }) => {
    if (request.method !== "PUT") return false;
    if (url.origin === self.location.origin && url.pathname.startsWith("/api")) {
      return true;
    }
    if (SUPABASE_ORIGIN && url.origin === SUPABASE_ORIGIN) {
      return url.pathname.includes("/rest/v1") || url.pathname.includes("/functions/v1");
    }
    return false;
  },
  new NetworkOnly({
    plugins: [backgroundSync],
  }),
  "PUT"
);

registerRoute(
  ({ url, request }) => {
    if (request.method !== "DELETE") return false;
    if (url.origin === self.location.origin && url.pathname.startsWith("/api")) {
      return true;
    }
    if (SUPABASE_ORIGIN && url.origin === SUPABASE_ORIGIN) {
      return url.pathname.includes("/rest/v1") || url.pathname.includes("/functions/v1");
    }
    return false;
  },
  new NetworkOnly({
    plugins: [backgroundSync],
  }),
  "DELETE"
);

registerRoute(
  ({ url, request }) => {
    if (request.method !== "PATCH") return false;
    if (url.origin === self.location.origin && url.pathname.startsWith("/api")) {
      return true;
    }
    if (SUPABASE_ORIGIN && url.origin === SUPABASE_ORIGIN) {
      return url.pathname.includes("/rest/v1") || url.pathname.includes("/functions/v1");
    }
    return false;
  },
  new NetworkOnly({
    plugins: [backgroundSync],
  }),
  "PATCH"
);

  self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = event.data.json() as Record<string, unknown>;
  } catch (_error) {
    payload = { title: event.data.text() };
  }

  const title = typeof payload.title === "string" && payload.title.length > 0
    ? (payload.title as string)
    : "ICUPA update";

  const body = typeof payload.body === "string" ? (payload.body as string) : "Your table has new activity.";
  const icon = typeof payload.icon === "string" ? (payload.icon as string) : "/placeholder.svg";
  const badge = typeof payload.badge === "string" ? (payload.badge as string) : "/placeholder.svg";
  const data = (payload.data ?? {}) as Record<string, unknown>;
  const tag = typeof payload.tag === "string" ? (payload.tag as string) : "icupa-generic";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data,
    })
  );
});

async function focusClient(targetUrl: string | undefined) {
  const clientList = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  if (clientList.length > 0) {
    const client = clientList[0]!;
    await client.focus();
    if (targetUrl) {
      void client.navigate(targetUrl);
    }
    return;
  }

  if (targetUrl) {
    await self.clients.openWindow(targetUrl);
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data as Record<string, unknown> | undefined;
  const targetUrl = typeof data?.url === "string" ? data.url : undefined;
  event.waitUntil(focusClient(targetUrl));
});
