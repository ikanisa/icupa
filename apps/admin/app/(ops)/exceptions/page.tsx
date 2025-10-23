import { CardGlass, buttonClassName } from "@ecotrips/ui";

import { getOpsFunctionClient } from "../../../lib/functionClient";
import { getFeatureFlaggedPayload } from "../../../lib/featureFlags";

type ExceptionRecord = Record<string, unknown> & {
  id?: string;
  type?: string;
  kind?: string;
  status?: string;
  supplier?: string | null;
  last_error?: string | null;
  occurred_at?: string | null;
  created_at?: string | null;
};

type LoadedExceptions = {
  rows: ExceptionRecord[];
  requestId?: string;
  offline: boolean;
};

async function loadExceptions(): Promise<LoadedExceptions> {
  try {
    const client = await getOpsFunctionClient();
    if (!client) {
      return { rows: [], offline: true };
    }

    const response = await client.call("ops.exceptions", { page: 1, page_size: 20 });
    return {
      rows: Array.isArray(response.data) ? (response.data as ExceptionRecord[]) : [],
      requestId: response.request_id,
      offline: !response.ok,
    };
  } catch (error) {
    console.error("ops.exceptions failed", error);
    return { rows: [], offline: true };
  }
}

function normalizeException(record: ExceptionRecord) {
  const id = record.id ?? "—";
  const source = record.type ?? record.kind ?? record.supplier ?? "ops";
  const status = record.status ?? "open";
  const detail = record.last_error ?? "No error message";
  const occurredRaw = record.occurred_at ?? record.created_at ?? null;
  let occurredAt = "—";
  if (typeof occurredRaw === "string" && occurredRaw) {
    const parsed = new Date(occurredRaw);
    occurredAt = Number.isNaN(parsed.getTime()) ? occurredRaw : parsed.toISOString().replace("T", " ").slice(0, 16);
  }

  return {
    id: String(id),
    source,
    status,
    detail,
    occurredAt,
  };
}

export default async function ExceptionsPage() {
  const result = await loadExceptions();
  const hasLiveRows = result.rows.length > 0;
  let rows = result.rows;
  let usedFixtures = false;

  if (!hasLiveRows) {
    const fixture = await getFeatureFlaggedPayload<ExceptionRecord[]>(
      "OPS_CONSOLE_EXCEPTIONS_FIXTURES",
      "ops.exceptions",
    );
    if (fixture.enabled && Array.isArray(fixture.payload)) {
      rows = fixture.payload;
      usedFixtures = true;
    } else {
      rows = [];
    }
  }

  const display = rows.map(normalizeException);

  return (
    <CardGlass title="Exceptions" subtitle="withObs instrumentation reports structured taxonomy codes.">
      {(result.offline || usedFixtures) && (
        <p className="mb-4 text-xs text-amber-200/80">
          {usedFixtures
            ? "Fixture fallback served via OPS_CONSOLE_EXCEPTIONS_FIXTURES while ops-exceptions recovers."
            : "ops-exceptions unavailable — monitor structured logs for TRANSIENT_RETRY signals."}
        </p>
      )}
      {!result.offline && !hasLiveRows && (
        <p className="mb-4 text-sm text-white/70">No active exceptions — keep monitoring with synthetics.</p>
      )}
      <div className="space-y-4">
        {display.length > 0 ? (
          display.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/60">{item.id}</p>
                <p className="text-sm text-white/80">{item.source} · {item.detail}</p>
                <p className="text-xs text-white/60">Status {item.status} · occurred {item.occurredAt}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className={buttonClassName("glass")}>
                  Retry one
                </button>
                <button type="button" className={buttonClassName("secondary")}>
                  Send to DLQ
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-white/70">No exception records available.</p>
        )}
      </div>
      {result.requestId && (
        <p className="mt-4 text-xs text-white/50">Request ID {result.requestId}</p>
      )}
    </CardGlass>
  );
}
