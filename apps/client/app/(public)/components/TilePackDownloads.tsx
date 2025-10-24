"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Toast } from "@ecotrips/ui";
import { createEcoTripsFunctionClient } from "@ecotrips/api";
import type { MapTilePack } from "@ecotrips/types";

const clientPromise = (async () => {
  if (typeof window === "undefined") return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;
  return createEcoTripsFunctionClient({
    supabaseUrl,
    anonKey,
    getAccessToken: async () => null,
  });
})();

type ToastState = { id: string; title: string; description?: string } | null;

type DownloadState = {
  status: "idle" | "downloading" | "complete";
  progress: number;
};

export function TilePackDownloads() {
  const [packs, setPacks] = useState<MapTilePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [reducedData, setReducedData] = useState(false);
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const timers = useRef<Record<string, number>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-data: reduce)");
    const handler = () => setReducedData(media.matches);
    handler();
    try {
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    } catch (_error) {
      media.addListener(handler);
      return () => media.removeListener(handler);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = await clientPromise;
        if (!client) {
          setError("Connect to Supabase to list offline packs.");
          return;
        }
        const response = await client.maps.tilesList();
        if (!cancelled) {
          setPacks(response.packs ?? []);
        }
      } catch (err) {
        console.error("maps.tiles.list", err);
        if (!cancelled) {
          setError("Unable to load tile pack metadata. Try again soon.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      for (const key of Object.keys(timers.current)) {
        clearInterval(timers.current[key]);
      }
    };
  }, []);

  const statusMessage = useMemo(() => {
    if (loading) return "Loading tile packs…";
    if (error) return error;
    if (packs.length === 0) return "No offline packs published yet.";
    return null;
  }, [loading, error, packs.length]);

  const startDownload = (pack: MapTilePack) => {
    setDownloads((prev) => ({
      ...prev,
      [pack.id]: { status: "downloading", progress: 0 },
    }));

    if (timers.current[pack.id]) {
      clearInterval(timers.current[pack.id]);
    }

    const interval = window.setInterval(() => {
      setDownloads((prev) => {
        const current = prev[pack.id];
        if (!current) return prev;
        if (current.status === "complete") {
          clearInterval(interval);
          return prev;
        }
        const increment = Math.max(1, Math.round(Math.random() * 12));
        const nextProgress = Math.min(100, current.progress + increment);
        const nextStatus = nextProgress >= 100 ? "complete" : "downloading";
        return {
          ...prev,
          [pack.id]: { ...current, progress: nextProgress, status: nextStatus },
        };
      });
    }, 450 + Math.random() * 300);

    timers.current[pack.id] = interval;

    if (reducedData) {
      setToast({
        id: `reduced-${pack.id}`,
        title: "Data saver override",
        description: "Downloads will respect data saver mode—progress is simulated only.",
      });
    }
  };

  const restartDownload = (pack: MapTilePack) => {
    setDownloads((prev) => ({
      ...prev,
      [pack.id]: { status: "idle", progress: 0 },
    }));
    startDownload(pack);
  };

  return (
    <div className="space-y-6">
      {statusMessage && <p className="text-sm text-white/70">{statusMessage}</p>}
      {!statusMessage && (
        <div className="grid gap-4 sm:grid-cols-2">
          {packs.map((pack) => {
            const state = downloads[pack.id] ?? { status: "idle", progress: 0 };
            return (
              <article
                key={pack.id}
                className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/20"
              >
                <div className="flex flex-col gap-3">
                  <header>
                    <p className="text-xs uppercase tracking-[0.2em] text-sky-200">{pack.region}</p>
                    <h3 className="text-lg font-semibold text-white">{pack.title}</h3>
                    <p className="text-sm text-white/70">{pack.description}</p>
                  </header>
                  <dl className="grid grid-cols-2 gap-2 text-xs text-white/60">
                    <div>
                      <dt className="font-semibold text-white/80">Last updated</dt>
                      <dd>{formatDate(pack.updated_at)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-white/80">Bundle size</dt>
                      <dd>{formatBytes(pack.bundle_bytes)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-white/80">Tiles</dt>
                      <dd>{pack.tiles.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-white/80">Coverage</dt>
                      <dd>{pack.coverage.radius_km.toFixed(0)} km radius</dd>
                    </div>
                  </dl>
                  {reducedData && (
                    <p className="rounded-2xl border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      Data saver is active. Downloads stay manual and progress is simulated until live tiles sync.
                    </p>
                  )}
                  <div>
                    <div className="mb-2 h-2 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-sky-400 transition-all"
                        style={{ width: `${state.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-white/60">
                      {state.status === "idle" && "Ready to download"}
                      {state.status === "downloading" && `Downloading… ${state.progress}%`}
                      {state.status === "complete" && "Download complete — available offline"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {state.status === "complete" ? (
                      <Button
                        className="w-full sm:w-auto"
                        onClick={() => restartDownload(pack)}
                        variant="secondary"
                      >
                        Refresh pack
                      </Button>
                    ) : (
                      <Button
                        className="w-full sm:w-auto"
                        onClick={() => startDownload(pack)}
                        variant={reducedData ? "secondary" : "primary"}
                      >
                        {state.status === "downloading" ? "Resume mock download" : "Download tile pack"}
                      </Button>
                    )}
                    <Button
                      className="w-full sm:w-auto"
                      variant="glass"
                      onClick={() =>
                        setToast({
                          id: `details-${pack.id}`,
                          title: pack.title,
                          description: `Tiles stored at ${pack.storage_path}. Checksum ${pack.checksum_sha256 ?? "n/a"}.`,
                        })
                      }
                    >
                      View details
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <div className="fixed bottom-24 left-1/2 z-40 w-full max-w-sm -translate-x-1/2">
        {toast && (
          <Toast id={toast.id} title={toast.title} description={toast.description} onDismiss={() => setToast(null)} />
        )}
      </div>
    </div>
  );
}

function formatDate(value: string): string {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch (_error) {
    return value;
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "–";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`;
}
