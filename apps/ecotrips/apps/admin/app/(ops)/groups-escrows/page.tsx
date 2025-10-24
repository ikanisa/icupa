import { CardGlass, Stepper } from "@ecotrips/ui";
import { GroupsOpsPayoutNowInput } from "@ecotrips/types";
import { revalidatePath } from "next/cache";

import { getOpsFunctionClient } from "../../../lib/functionClient";
import { logAdminAction } from "../../../lib/logging";
import { getFeatureFlaggedPayload } from "../../../lib/featureFlags";

import { TriggerPayoutForm, type PayoutFormState } from "./TriggerPayoutForm";

type ReportRow = {
  id?: string;
  escrow_id?: string;
  total_cents?: number;
  currency?: string;
  status?: string;
  attempts?: number;
  last_error?: string | null;
  created_at?: string;
};

type ReportCounts = { status: string; currency: string; count: number };

type LoadedReport = {
  ok: boolean;
  counts: ReportCounts[];
  recent: ReportRow[];
  requestId?: string;
  offline: boolean;
};

async function loadReport(): Promise<LoadedReport> {
  try {
    const client = await getOpsFunctionClient();
    if (!client) {
      return { ok: false, counts: [], recent: [], offline: true };
    }

    const response = await client.call("groups.payouts.report", {});
    return {
      ok: response.ok,
      counts: Array.isArray(response.counts) ? response.counts : [],
      recent: Array.isArray(response.recent) ? response.recent : [],
      requestId: response.request_id,
      offline: !response.ok,
    };
  } catch (error) {
    console.error("groups.payouts.report", error);
    return { ok: false, counts: [], recent: [], offline: true };
  }
}

async function triggerPayoutAction(_: PayoutFormState, formData: FormData): Promise<PayoutFormState> {
  "use server";

  const escrowId = formData.get("escrowId");
  const parsed = GroupsOpsPayoutNowInput.safeParse({ escrow_id: typeof escrowId === "string" ? escrowId.trim() : "" });
  if (!parsed.success) {
    logAdminAction("groups.payout.now", { status: "validation_failed" });
    return { status: "error", message: "Provide a valid escrow UUID." };
  }

  const client = await getOpsFunctionClient();
  if (!client) {
    logAdminAction("groups.payout.now", { status: "offline" });
    return { status: "offline", message: "Supabase session missing. Sign in again." };
  }

  try {
    const response = await client.call("groups.ops.payoutNow", parsed.data);
    if (response.ok) {
      revalidatePath("/groups-escrows");
      logAdminAction("groups.payout.now", {
        status: "success",
        requestId: response.request_id,
        escrowId: response.escrow_id ?? parsed.data.escrow_id,
        payoutStatus: response.payout_status ?? "queued",
      });
      return {
        status: "success",
        message: `Payout ${response.payout_status ?? "queued"} for ${response.escrow_id ?? "escrow"}`,
        requestId: response.request_id,
      };
    }
    logAdminAction("groups.payout.now", { status: "error", requestId: response.request_id });
    return { status: "error", message: "Edge function returned non-ok response." };
  } catch (error) {
    console.error("groups.ops.payoutNow", error);
    logAdminAction("groups.payout.now", { status: "error", error: error instanceof Error ? error.message : String(error) });
    return { status: "error", message: "Check withObs logs for failure details." };
  }
}

function formatAmount(row: ReportRow) {
  if (typeof row.total_cents === "number" && Number.isFinite(row.total_cents)) {
    return `${row.currency ?? "USD"} ${(row.total_cents / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return "—";
}

export default async function GroupsEscrowsPage() {
  const report = await loadReport();
  let recent = report.recent;
  let counts = report.counts;
  let usedFixtures = false;

  if ((recent.length === 0 && counts.length === 0) || report.offline) {
    const fixture = await getFeatureFlaggedPayload<{ counts?: ReportCounts[]; recent?: ReportRow[] }>(
      "OPS_CONSOLE_GROUPS_REPORT_FIXTURES",
      "groups.payouts.report",
    );
    if (fixture.enabled && fixture.payload) {
      counts = Array.isArray(fixture.payload.counts) ? fixture.payload.counts : [];
      recent = Array.isArray(fixture.payload.recent) ? fixture.payload.recent : [];
      usedFixtures = true;
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <CardGlass title="Group Escrows" subtitle="Track contributions and trigger payouts when thresholds hit.">
        {(report.offline || usedFixtures) && (
          <p className="mb-3 text-xs text-amber-200/80">
            {usedFixtures
              ? "Fixture fallback served via OPS_CONSOLE_GROUPS_REPORT_FIXTURES while groups-payouts-report recovers."
              : "Edge function offline — monitoring instrumentation while recovery completes."}
          </p>
        )}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 p-4">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/60">Payout status</h3>
            <ul className="space-y-2 text-sm text-white/80">
              {(counts.length > 0 ? counts : []).map((item) => (
                <li key={`${item.status}-${item.currency}`} className="flex items-center justify-between">
                  <span className="capitalize">{item.status.replace(/_/g, " ")}</span>
                  <span>
                    {item.currency} · {item.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">Recent payouts</h3>
            <div className="space-y-3">
              {recent.length === 0 ? (
                <p className="text-sm text-white/70">No payouts recorded yet.</p>
              ) : (
                recent.map((row, index) => (
                  <div key={row.id ?? row.escrow_id ?? `fallback-${index}`} className="rounded-2xl border border-white/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-white/60">{row.escrow_id ?? "Escrow"}</p>
                        <p className="text-white/80">{formatAmount(row)}</p>
                      </div>
                      <div className="text-right text-xs text-white/60">
                        <p className="capitalize">{(row.status ?? "unknown").replace(/_/g, " ")}</p>
                        <p>{row.created_at ? new Date(row.created_at).toISOString().replace("T", " ").slice(0, 16) : "—"}</p>
                      </div>
                    </div>
                    {row.last_error && <p className="mt-2 text-xs text-rose-200/80">{row.last_error}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
          <TriggerPayoutForm action={triggerPayoutAction} lastEscrowId={recent[0]?.escrow_id} />
          {report.requestId && (
            <p className="text-xs text-white/50">Request ID {report.requestId}</p>
          )}
        </div>
      </CardGlass>
      <CardGlass title="Ops Actions" subtitle="Escalate at-risk escrows with HITL controls.">
        <Stepper
          steps={[
            { id: "monitor", label: "Monitor contributions daily", status: "complete" },
            { id: "remind", label: "Send reminder 72h before deadline", status: "current" },
            { id: "payout", label: "Queue manual payout verification", status: "pending" },
          ]}
        />
      </CardGlass>
    </div>
  );
}
