/// <reference lib="webworker" />
/// <reference lib="es2017" />

import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, setDefaultHandler } from "workbox-routing";
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
const manifest = (self as unknown as { __WB_MANIFEST?: ManifestEntry[] }).__WB_MANIFEST;

const SUPABASE_ORIGIN = (() => {
  try {
    const value = (import.meta as { env?: Record<string, string | undefined> })?.env?.
      VITE_SUPABASE_URL;
    return value ? new URL(value).origin : null;
  } catch (_error) {
    return null;
  }
})();

const API_QUEUE_TAG = "workbox-background-sync:icupa-api-queue";
const SYNC_COMPLETE_MESSAGE = "icupa-sync-complete";

let queuedSinceLastSync = 0;
let failedSinceLastSync = 0;
let hasBroadcastForCurrentBatch = true;
let firstQueuedTimestamp: number | null = null;

type BroadcastMetrics = {
  batchId?: string;
  replayedCount?: number;
  failedCount?: number;
  latencyMs?: number | null;
  queueStartedAt?: string | null;
  replayCompletedAt?: string | null;
};

function generateBatchId(): string {
  try {
    if (typeof self.crypto !== "undefined" && "randomUUID" in self.crypto) {
      return self.crypto.randomUUID();
    }
  } catch (_error) {
    // ignore
  }
  return `sync-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function broadcastSyncComplete(metrics?: BroadcastMetrics): Promise<void> {
  const operationsToReport = metrics?.replayedCount ?? queuedSinceLastSync;
  const failuresToReport = metrics?.failedCount ?? failedSinceLastSync;
  const now = Date.now();
  const derivedLatency = firstQueuedTimestamp ? Math.max(0, now - firstQueuedTimestamp) : null;
  const latencyMs = metrics?.latencyMs ?? derivedLatency;
  const queueStartedAt =
    metrics?.queueStartedAt ?? (firstQueuedTimestamp ? new Date(firstQueuedTimestamp).toISOString() : null);
  const replayCompletedAt = metrics?.replayCompletedAt ?? new Date(now).toISOString();

  if (hasBroadcastForCurrentBatch) {
    queuedSinceLastSync = 0;
    failedSinceLastSync = 0;
    firstQueuedTimestamp = null;
    return;
  }

  hasBroadcastForCurrentBatch = true;

  const batchId = metrics?.batchId ?? generateBatchId();

  queuedSinceLastSync = 0;
  failedSinceLastSync = 0;
  firstQueuedTimestamp = null;

  if (operationsToReport <= 0 && failuresToReport <= 0) {
    return;
  }

  const clientList = await self.clients.matchAll({
    includeUncontrolled: true,
    type: "window",
  });

  const payload = {
    type: SYNC_COMPLETE_MESSAGE,
    replayedCount: operationsToReport,
    failedCount: failuresToReport,
    latencyMs,
    queueStartedAt,
    replayCompletedAt,
    batchId,
  } as const;

  await Promise.all(clientList.map((client) => client.postMessage(payload)));
}

self.skipWaiting();
clientsClaim();

if (manifest) {
  precacheAndRoute(manifest);
  cleanupOutdatedCaches();
}

setDefaultHandler(
  new NetworkFirst({
    cacheName: "icupa-pages",
    networkTimeoutSeconds: 5,
  })
);

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

const backgroundSync = new BackgroundSyncPlugin("icupa-api-queue", {
  maxRetentionTime: 60,
  callbacks: {
    async requestWillEnqueue() {
      queuedSinceLastSync += 1;
      hasBroadcastForCurrentBatch = false;
      if (firstQueuedTimestamp === null) {
        firstQueuedTimestamp = Date.now();
      }
    },
    async fetchDidFail() {
      failedSinceLastSync += 1;
    },
    async queueDidReplay() {
      const completedAt = new Date().toISOString();
      await broadcastSyncComplete({
        batchId: generateBatchId(),
        replayedCount: queuedSinceLastSync,
        failedCount: failedSinceLastSync,
        latencyMs: firstQueuedTimestamp ? Math.max(0, Date.now() - firstQueuedTimestamp) : null,
        queueStartedAt: firstQueuedTimestamp ? new Date(firstQueuedTimestamp).toISOString() : null,
        replayCompletedAt: completedAt,
      });
    },
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

self.addEventListener("sync", (event) => {
  if (event.tag !== API_QUEUE_TAG) {
    return;
  }

  event.waitUntil(broadcastSyncComplete());
});

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
