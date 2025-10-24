import { CardGlass } from "@ecotrips/ui";
import { DrSnapshotInput } from "@ecotrips/types";

import { getOpsFunctionClient } from "../../../lib/functionClient";
import { getFeatureFlaggedPayload } from "../../../lib/featureFlags";
import { createAdminServerClient } from "../../../lib/supabaseServer";
import { logAdminAction } from "../../../lib/logging";

import { SnapshotForm, type SnapshotState } from "./SnapshotForm";

async function createSnapshotAction(_: SnapshotState, formData: FormData): Promise<SnapshotState> {
  "use server";

  const rawTables = String(formData.get("tables") ?? "");
  const tables = rawTables
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const payload = DrSnapshotInput.safeParse({
    label: String(formData.get("label") ?? "").trim(),
    tables: tables.length > 0 ? tables : undefined,
  });

  if (!payload.success) {
    logAdminAction("dr.snapshot", { status: "validation_failed" });
    return { status: "error", message: "Label required (min 3 characters)." };
  }

  const client = await getOpsFunctionClient();
  if (!client) {
    logAdminAction("dr.snapshot", { status: "offline" });
    return { status: "offline", message: "Supabase session missing." };
  }

  try {
    const response = await client.call("dr.snapshot", payload.data);
    if (!response.ok) {
      logAdminAction("dr.snapshot", { status: "error", requestId: response.request_id });
      return { status: "error", message: "Snapshot failed." };
    }
    logAdminAction("dr.snapshot", {
      status: "success",
      requestId: response.request_id,
      label: payload.data.label,
    });
    return {
      status: "success",
      detail: `Snapshot ${response.snapshot_id ?? "created"} · ${response.object_path ?? "stored"}`,
    };
  } catch (error) {
    console.error("dr.snapshot", error);
    logAdminAction("dr.snapshot", { status: "error", error: error instanceof Error ? error.message : String(error) });
    return { status: "error", message: "Check withObs taxonomy for details." };
  }
}

export default function DRPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SnapshotsPanel />
      <CardGlass title="Runbook" subtitle="DR drills run quarterly with cross-team observers.">
        <p className="text-sm text-white/80">
          Synthetic probes monitor health endpoints every five minutes. Perf smoke tests enforce p95 ≤ 800ms with ≤ 1 error and
          snapshot drills use withObs for structured telemetry.
        </p>
      </CardGlass>
    </div>
  );
}

async function loadSnapshots() {
  const supabase = await createAdminServerClient();
  if (!supabase) {
    return { rows: [], offline: true };
  }

  const { data, error } = await supabase
    .from("ops.v_dr_snapshots")
    .select("id,label,created_at,tables")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("ops.v_dr_snapshots", error);
    return { rows: [], offline: true };
  }

  return { rows: Array.isArray(data) ? data : [], offline: false };
}

async function SnapshotsPanel() {
  const result = await loadSnapshots();
  let rows = result.rows;
  let usedFixtures = false;

  if (rows.length === 0) {
    const fixture = await getFeatureFlaggedPayload<Array<{ id: string; label: string; generated_at: string; tables: number }>>(
      "OPS_CONSOLE_DR_FIXTURES",
      "dr.snapshots",
    );
    if (fixture.enabled && Array.isArray(fixture.payload)) {
      rows = fixture.payload.map((entry) => ({
        id: entry.id,
        label: entry.label,
        created_at: entry.generated_at,
        tables: entry.tables,
      }));
      usedFixtures = true;
    }
  }

  return (
    <CardGlass title="Snapshots" subtitle="DR snapshots stored under dr_backups/ bucket.">
      <SnapshotForm action={createSnapshotAction} />
      {(result.offline || usedFixtures) && (
        <p className="mt-4 text-xs text-amber-200/80">
          {usedFixtures
            ? "Fixture fallback served via OPS_CONSOLE_DR_FIXTURES while DR registry recovers."
            : "Snapshot registry offline — retry after verifying withObs telemetry."}
        </p>
      )}
      <div className="mt-6 space-y-3 text-sm">
        {rows.length === 0 ? (
          <p className="text-sm text-white/70">No DR snapshots available.</p>
        ) : (
          rows.map((snapshot) => {
            const generatedAt = typeof snapshot.created_at === "string" ? snapshot.created_at : "";
            const formatted = generatedAt ? generatedAt.replace("T", " ").slice(0, 16) : "—";
            const tables = Array.isArray(snapshot.tables)
              ? snapshot.tables.length
              : typeof snapshot.tables === "number"
                ? snapshot.tables
                : typeof snapshot.tables === "string"
                  ? Number(snapshot.tables)
                  : undefined;
            return (
              <div key={snapshot.id} className="flex items-center justify-between rounded-2xl border border-white/10 p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/60">{snapshot.label ?? "snapshot"}</p>
                  <p className="text-white/80">Generated {formatted}</p>
                </div>
                <p className="text-xs text-white/60">{Number.isFinite(tables) ? `${tables} tables` : "—"}</p>
              </div>
            );
          })
        )}
      </div>
    </CardGlass>
  );
}
