import { CardGlass } from "@ecotrips/ui";
import { DrSnapshotInput } from "@ecotrips/types";

import { getOpsFunctionClient } from "../../../lib/functionClient";

import { SnapshotForm } from "./SnapshotForm";

type SnapshotState = {
  status: "idle" | "success" | "error" | "offline";
  message?: string;
  detail?: string;
};

const fallbackSnapshots = [
  { id: "snap-2024-05-04", label: "daily", generatedAt: "2024-05-04T08:00:00Z", tables: 9 },
  { id: "snap-2024-05-03", label: "daily", generatedAt: "2024-05-03T08:00:00Z", tables: 9 },
];

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
    return { status: "error", message: "Label required (min 3 characters)." };
  }

  const client = await getOpsFunctionClient();
  if (!client) {
    return { status: "offline", message: "Supabase session missing." };
  }

  try {
    const response = await client.call("dr.snapshot", payload.data);
    if (!response.ok) {
      return { status: "error", message: "Snapshot failed." };
    }
    return {
      status: "success",
      detail: `Snapshot ${response.snapshot_id ?? "created"} · ${response.object_path ?? "stored"}`,
    };
  } catch (error) {
    console.error("dr.snapshot", error);
    return { status: "error", message: "Check withObs taxonomy for details." };
  }
}

export default function DRPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CardGlass title="Snapshots" subtitle="DR snapshots stored under dr_backups/ bucket.">
        <SnapshotForm action={createSnapshotAction} />
        <div className="mt-6 space-y-3 text-sm">
          {fallbackSnapshots.map((snapshot) => (
            <div key={snapshot.id} className="flex items-center justify-between rounded-2xl border border-white/10 p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/60">{snapshot.label}</p>
                <p className="text-white/80">Generated {snapshot.generatedAt.replace("T", " ").slice(0, 16)}</p>
              </div>
              <p className="text-xs text-white/60">{snapshot.tables} tables</p>
            </div>
          ))}
        </div>
      </CardGlass>
      <CardGlass title="Runbook" subtitle="DR drills run quarterly with cross-team observers.">
        <p className="text-sm text-white/80">
          Synthetic probes monitor health endpoints every five minutes. Perf smoke tests enforce p95 ≤ 800ms with ≤ 1 error and
          snapshot drills use withObs for structured telemetry.
        </p>
      </CardGlass>
    </div>
  );
}
