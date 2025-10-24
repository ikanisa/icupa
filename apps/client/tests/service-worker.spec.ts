import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.resolve(__dirname, "..");
const publicDir = path.join(clientDir, "public");
const serviceWorkerPath = path.join(publicDir, "sw.js");
const buildScript = path.join(clientDir, "scripts", "build-sw.mjs");

const MIME_TYPES = new Map([
  [".js", "application/javascript"],
  [".json", "application/json"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json"],
]);

async function buildServiceWorker(version: string) {
  await execFileAsync("node", [buildScript], {
    cwd: clientDir,
    env: { ...process.env, SW_BUILD_VERSION: version },
  });
}

async function execFileAsync(command: string, args: string[], options: Record<string, unknown>) {
  return new Promise<void>((resolve, reject) => {
    execFile(command, args, options, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

type TestServer = {
  origin: string;
  close: () => Promise<void>;
};

async function startStaticServer(): Promise<TestServer> {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const pathname = url.pathname;

    if (pathname === "/") {
      res.writeHead(200, {
        "Content-Type": "text/html",
        "Cache-Control": "no-store",
      });
      res.end(`<!doctype html><html><head><meta charset="utf-8"><title>SW Test</title></head><body><script>
        (async () => {
          try {
            await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;
          } catch (error) {
            console.error('registration failed', error);
          }
        })();
      </script></body></html>`);
      return;
    }

    const safePath = path.resolve(publicDir, `.${pathname}`);
    if (!safePath.startsWith(publicDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const filePath = safePath;

    try {
      const fileContents = await readFile(filePath);
      const mimeType = MIME_TYPES.get(path.extname(filePath)) ?? "application/octet-stream";
      res.writeHead(200, {
        "Content-Type": mimeType,
        "Cache-Control": "no-store",
        "Service-Worker-Allowed": "/",
      });
      res.end(fileContents);
    } catch (error) {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const addressInfo = server.address();
  if (!addressInfo || typeof addressInfo === "string") {
    throw new Error("Unable to determine server address");
  }

  const origin = `http://127.0.0.1:${addressInfo.port}`;
  return {
    origin,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

async function readCacheState(page: Page) {
  return page.evaluate(async () => {
    const cacheNames = await caches.keys();
    cacheNames.sort();
    const cacheEntries = await Promise.all(
      cacheNames.map(async (name) => {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        return {
          name,
          urls: requests.map((request) => new URL(request.url).pathname).sort(),
        };
      }),
    );
    return { names: cacheNames, entries: cacheEntries };
  });
}

async function waitForController(page: Page) {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

test.describe("service worker cache lifecycle", () => {
  test("purges stale caches on deployment", async ({ page }) => {
    const versionBase = `test-${Date.now()}`;
    const initialVersion = `${versionBase}-v1`;
    const updatedVersion = `${versionBase}-v2`;

    const originalServiceWorker = await readFile(serviceWorkerPath, "utf8");
    let server: TestServer | null = null;

    try {
      await buildServiceWorker(initialVersion);
      const activeServer = await startStaticServer();
      server = activeServer;

      await page.goto(activeServer.origin, { waitUntil: "load" });
      await waitForController(page);

      await page.waitForFunction(
        (version) =>
          caches.keys().then((keys) => keys.some((key) => key.includes(version))),
        initialVersion,
      );

      const firstSnapshot = await readCacheState(page);
      expect(firstSnapshot.names.some((name) => name.includes(initialVersion))).toBeTruthy();

      await buildServiceWorker(updatedVersion);

      await page.reload({ waitUntil: "load" });
      await waitForController(page);

      await page.waitForFunction(
        (version) =>
          caches.keys().then((keys) => keys.some((key) => key.includes(version))),
        updatedVersion,
      );
      await page.waitForFunction(
        (version) =>
          caches.keys().then((keys) => keys.every((key) => !key.includes(version))),
        initialVersion,
      );

      const secondSnapshot = await readCacheState(page);
      expect(secondSnapshot.names.some((name) => name.includes(updatedVersion))).toBeTruthy();
      expect(secondSnapshot.names.some((name) => name.includes(initialVersion))).toBeFalsy();
    } finally {
      if (server) {
        await server.close();
      }
      await writeFile(serviceWorkerPath, originalServiceWorker, "utf8");
    }
  });
});
