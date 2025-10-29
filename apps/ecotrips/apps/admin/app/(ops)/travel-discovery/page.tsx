import { CardGlass } from "@ecotrips/ui";

import { createAdminServerClient } from "../../lib/supabaseServer";
import type { AdminDatabase } from "../../../lib/databaseTypes";

type IngestionRow = AdminDatabase["ops"]["Views"]["v_travel_ingestion_health"]["Row"];
type EmbeddingRow = AdminDatabase["ops"]["Views"]["v_trip_embeddings"]["Row"];

function formatHours(value: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  if (value < 1) return `${Math.round(value * 60)}m ago`;
  if (value > 48) return `${(value / 24).toFixed(1)}d ago`;
  return `${value.toFixed(1)}h ago`;
}

async function loadIngestion(): Promise<{ rows: IngestionRow[]; offline: boolean }> {
  const supabase = await createAdminServerClient();
  if (!supabase) {
    return { rows: [], offline: true };
  }
  const { data, error } = await supabase
    .from<IngestionRow>("ops.v_travel_ingestion_health")
    .select(
      "trip_id,trip_name,trip_kind,discovery_key,summary,last_ingested_at,ingestion_source,hours_since_refresh,poi_items,event_items",
    )
    .order("last_ingested_at", { ascending: false })
    .limit(10);
  if (error) {
    console.error("ops.v_travel_ingestion_health", error);
    return { rows: [], offline: true };
  }
  return { rows: Array.isArray(data) ? data : [], offline: false };
}

async function loadEmbeddings(): Promise<{ rows: EmbeddingRow[]; offline: boolean }> {
  const supabase = await createAdminServerClient();
  if (!supabase) {
    return { rows: [], offline: true };
  }
  const { data, error } = await supabase
    .from<EmbeddingRow>("ops.v_trip_embeddings")
    .select(
      "trip_id,trip_name,trip_kind,itinerary_id,discovery_key,last_ingested_at,embedding_dimensions,embedding_norm",
    )
    .order("last_ingested_at", { ascending: false })
    .limit(10);
  if (error) {
    console.error("ops.v_trip_embeddings", error);
    return { rows: [], offline: true };
  }
  return { rows: Array.isArray(data) ? data : [], offline: false };
}

export default async function TravelDiscoveryPage() {
  const [{ rows: ingestionRows, offline: ingestionOffline }, { rows: embeddingRows, offline: embeddingOffline }] =
    await Promise.all([loadIngestion(), loadEmbeddings()]);

  return (
    <div className="space-y-6">
      <CardGlass
        title="Travel discovery ingestion"
        subtitle="Cron-backed travel-discovery edge function keeps POI/events fresh"
      >
        {ingestionRows.length === 0 ? (
          <p className="text-sm text-white/70">
            {ingestionOffline
              ? "Unable to load ops.v_travel_ingestion_health. Check service role configuration."
              : "No discovery ingestions recorded yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm text-white/80">
              <thead className="text-xs uppercase tracking-wide text-white/50">
                <tr>
                  <th className="px-3 pb-2 font-normal">Trip</th>
                  <th className="px-3 pb-2 font-normal">Key</th>
                  <th className="px-3 pb-2 font-normal">POI</th>
                  <th className="px-3 pb-2 font-normal">Events</th>
                  <th className="px-3 pb-2 font-normal">Last refresh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {ingestionRows.map((row) => (
                  <tr key={row.trip_id}>
                    <td className="px-3 py-3 align-top">
                      <div className="font-semibold text-white">{row.trip_name}</div>
                      <div className="text-xs text-white/50">{row.trip_kind}</div>
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-white/70">{row.discovery_key ?? "—"}</td>
                    <td className="px-3 py-3 align-top">{row.poi_items ?? 0}</td>
                    <td className="px-3 py-3 align-top">{row.event_items ?? 0}</td>
                    <td className="px-3 py-3 align-top">
                      <div>{formatHours(row.hours_since_refresh ?? null)}</div>
                      {row.ingestion_source && (
                        <div className="text-xs text-white/50">via {row.ingestion_source}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardGlass>
      <CardGlass
        title="Itinerary embeddings"
        subtitle="Vector norms expose stale data and highlight recent discovery updates"
      >
        {embeddingRows.length === 0 ? (
          <p className="text-sm text-white/70">
            {embeddingOffline
              ? "Unable to load ops.v_trip_embeddings. Check service role configuration."
              : "No discovery embeddings available yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm text-white/80">
              <thead className="text-xs uppercase tracking-wide text-white/50">
                <tr>
                  <th className="px-3 pb-2 font-normal">Trip</th>
                  <th className="px-3 pb-2 font-normal">Dimensions</th>
                  <th className="px-3 pb-2 font-normal">Norm</th>
                  <th className="px-3 pb-2 font-normal">Last ingest</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {embeddingRows.map((row) => (
                  <tr key={`${row.trip_id}-${row.discovery_key ?? ""}`}>
                    <td className="px-3 py-3 align-top">
                      <div className="font-semibold text-white">{row.trip_name}</div>
                      <div className="text-xs text-white/50">{row.discovery_key ?? "—"}</div>
                    </td>
                    <td className="px-3 py-3 align-top">{row.embedding_dimensions ?? "—"}</td>
                    <td className="px-3 py-3 align-top">{row.embedding_norm?.toFixed(4) ?? "—"}</td>
                    <td className="px-3 py-3 align-top">{row.last_ingested_at ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardGlass>
      <CardGlass title="Cron schedules" subtitle="Supabase cron keeps travel-discovery fresh">
        <ul className="space-y-2 text-sm text-white/70">
          <li>
            <span className="font-semibold text-white">travel-discovery-poi-hourly</span> — runs every hour with{" "}
            <code>{`{ "mode": "poi" }`}</code>.
          </li>
          <li>
            <span className="font-semibold text-white">travel-discovery-events-six-hourly</span> — runs every 6 hours with{" "}
            <code>{`{ "mode": "events" }`}</code>.
          </li>
        </ul>
      </CardGlass>
    </div>
  );
}
