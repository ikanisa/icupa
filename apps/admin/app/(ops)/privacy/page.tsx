import { CardGlass, Toast } from "@ecotrips/ui";
import {
  PrivacyErasureExecuteInput,
  PrivacyErasurePlanInput,
  PrivacyExportInput,
  PrivacyRequestInput,
  PrivacyReviewInput,
  PIIScanInput,
  type PIIFinding,
} from "@ecotrips/types";

import { getOpsFunctionClient } from "../../../lib/functionClient";
import { logAdminAction, recordAuditEvent } from "../../../lib/logging";

import { ActionForm, type ActionFormState } from "./ActionForm";

type ServerState = ActionFormState;

type PIIScanState = ActionFormState & {
  findings?: PIIFinding[];
  riskScore?: number;
  requestId?: string;
  label?: string;
};

async function requestAction(_: ServerState, formData: FormData): Promise<ServerState> {
  "use server";

  const payload = PrivacyRequestInput.safeParse({
    kind: String(formData.get("kind") ?? "export").toLowerCase(),
    subject_user_id: String(formData.get("subject") ?? ""),
    reason: formData.get("reason") ? String(formData.get("reason")) : undefined,
  });

  if (!payload.success) {
    logAdminAction("privacy.request", { status: "validation_failed" });
    return { status: "error", message: "Valid subject UUID required." };
  }

  const client = await getOpsFunctionClient();
  if (!client) {
    logAdminAction("privacy.request", { status: "offline" });
    return { status: "offline", message: "Supabase session missing." };
  }

  try {
    const response = await client.call("privacy.request", payload.data);
    if (!response.ok || !response.request_id) {
      logAdminAction("privacy.request", { status: "error", requestId: response.request_id });
      return { status: "error", message: "Edge function reported failure." };
    }
    logAdminAction("privacy.request", {
      status: "success",
      requestId: response.request_id,
      kind: payload.data.kind,
    });
    return { status: "success", detail: `Request ${response.request_id}` };
  } catch (error) {
    console.error("privacy.request", error);
    logAdminAction("privacy.request", { status: "error", error: error instanceof Error ? error.message : String(error) });
    return { status: "error", message: "Check withObs taxonomy for details." };
  }
}

async function reviewAction(_: ServerState, formData: FormData): Promise<ServerState> {
  "use server";

  const payload = PrivacyReviewInput.safeParse({
    request_id: String(formData.get("requestId") ?? ""),
    decision: String(formData.get("decision") ?? "approve").toLowerCase() as "approve" | "reject",
    note: formData.get("note") ? String(formData.get("note")) : undefined,
  });

  if (!payload.success) {
    logAdminAction("privacy.review", { status: "validation_failed" });
    return { status: "error", message: "Provide request id and decision." };
  }

  const client = await getOpsFunctionClient();
  if (!client) {
    logAdminAction("privacy.review", { status: "offline" });
    return { status: "offline", message: "Supabase session missing." };
  }

  try {
    const response = await client.call("privacy.review", payload.data);
    if (!response.ok) {
      logAdminAction("privacy.review", { status: "error", requestId: response.request_id });
      return { status: "error", message: "Review failed." };
    }
    logAdminAction("privacy.review", {
      status: "success",
      requestId: response.request_id,
      decision: payload.data.decision,
    });
    return { status: "success", detail: `Request now ${response.status ?? "updated"}` };
  } catch (error) {
    console.error("privacy.review", error);
    logAdminAction("privacy.review", { status: "error", error: error instanceof Error ? error.message : String(error) });
    return { status: "error", message: "Check withObs taxonomy for details." };
  }
}

async function exportAction(_: ServerState, formData: FormData): Promise<ServerState> {
  "use server";

  const payload = PrivacyExportInput.safeParse({ request_id: String(formData.get("requestId") ?? "") });
  if (!payload.success) {
    logAdminAction("privacy.export", { status: "validation_failed" });
    return { status: "error", message: "Request id required." };
  }

  const client = await getOpsFunctionClient();
  if (!client) {
    logAdminAction("privacy.export", { status: "offline" });
    return { status: "offline", message: "Supabase session missing." };
  }

  try {
    const response = await client.call("privacy.export", payload.data);
    if (!response.ok) {
      logAdminAction("privacy.export", { status: "error", requestId: response.request_id });
      return { status: "error", message: "Export failed." };
    }
    logAdminAction("privacy.export", {
      status: "success",
      requestId: response.request_id,
    });
    return {
      status: "success",
      detail: response.signed_url ? `Signed URL ready: ${response.signed_url}` : "Export queued",
    };
  } catch (error) {
    console.error("privacy.export", error);
    logAdminAction("privacy.export", { status: "error", error: error instanceof Error ? error.message : String(error) });
    return { status: "error", message: "Check withObs taxonomy for details." };
  }
}

async function planAction(_: ServerState, formData: FormData): Promise<ServerState> {
  "use server";

  const payload = PrivacyErasurePlanInput.safeParse({ request_id: String(formData.get("requestId") ?? "") });
  if (!payload.success) {
    logAdminAction("privacy.erasure.plan", { status: "validation_failed" });
    return { status: "error", message: "Request id required." };
  }

  const client = await getOpsFunctionClient();
  if (!client) {
    logAdminAction("privacy.erasure.plan", { status: "offline" });
    return { status: "offline", message: "Supabase session missing." };
  }

  try {
    const response = await client.call("privacy.erasure.plan", payload.data);
    if (!response.ok) {
      logAdminAction("privacy.erasure.plan", { status: "error", requestId: response.request_id });
      return { status: "error", message: "Plan generation failed." };
    }
    logAdminAction("privacy.erasure.plan", {
      status: "success",
      requestId: response.request_id,
    });
    return {
      status: "success",
      detail: response.signed_url ? `Plan ready: ${response.signed_url}` : "Dry-run completed",
    };
  } catch (error) {
    console.error("privacy.erasure.plan", error);
    logAdminAction("privacy.erasure.plan", { status: "error", error: error instanceof Error ? error.message : String(error) });
    return { status: "error", message: "Check withObs taxonomy for details." };
  }
}

async function executeAction(_: ServerState, formData: FormData): Promise<ServerState> {
  "use server";

  const payload = PrivacyErasureExecuteInput.safeParse({
    request_id: String(formData.get("requestId") ?? ""),
    confirm: String(formData.get("confirm") ?? "").toUpperCase() as "ERASE",
  });

  if (!payload.success) {
    logAdminAction("privacy.erasure.execute", { status: "validation_failed" });
    return { status: "error", message: "Confirm with ERASE and provide request id." };
  }

  const client = await getOpsFunctionClient();
  if (!client) {
    logAdminAction("privacy.erasure.execute", { status: "offline" });
    return { status: "offline", message: "Supabase session missing." };
  }

  try {
    const response = await client.call("privacy.erasure.execute", payload.data);
    if (!response.ok) {
      logAdminAction("privacy.erasure.execute", { status: "error", requestId: response.request_id });
      return { status: "error", message: "Erasure execution failed." };
    }
    logAdminAction("privacy.erasure.execute", {
      status: "success",
      requestId: response.request_id,
    });
    return {
      status: "success",
      detail: response.summary ? `Tables affected: ${response.summary.length}` : "Erasure completed",
    };
  } catch (error) {
    console.error("privacy.erasure.execute", error);
    logAdminAction("privacy.erasure.execute", {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: "error", message: "Check withObs taxonomy for details." };
  }
}

async function piiScanAction(_: PIIScanState, formData: FormData): Promise<PIIScanState> {
  "use server";

  const payload = PIIScanInput.safeParse({
    label: (() => {
      const value = String(formData.get("label") ?? "").trim();
      return value.length > 0 ? value : undefined;
    })(),
    content: String(formData.get("content") ?? ""),
  });

  if (!payload.success) {
    logAdminAction("privacy.pii.scan", { status: "validation_failed" });
    return { status: "error", message: "Provide text to scan." };
  }

  const client = await getOpsFunctionClient();
  if (!client) {
    logAdminAction("privacy.pii.scan", { status: "offline" });
    return { status: "offline", message: "Supabase session missing." };
  }

  const idempotencyKey = crypto.randomUUID();

  try {
    const response = await client.call("privacy.pii.scan", payload.data, { idempotencyKey });

    if (!response.ok) {
      logAdminAction("privacy.pii.scan", {
        status: "error",
        requestId: response.request_id ?? idempotencyKey,
        findings: response.findings.length,
      });

      await recordAuditEvent("privacy.pii.scan", {
        label: payload.data.label ?? null,
        request_id: response.request_id ?? idempotencyKey,
        findings: response.findings,
        risk_score: response.risk_score ?? null,
        status: "error",
      });

      return {
        status: "error",
        message: "Scan failed. Review telemetry for details.",
      };
    }

    logAdminAction("privacy.pii.scan", {
      status: "success",
      requestId: response.request_id ?? idempotencyKey,
      findings: response.findings.length,
      riskScore: response.risk_score ?? null,
    });

    await recordAuditEvent("privacy.pii.scan", {
      label: payload.data.label ?? null,
      request_id: response.request_id ?? idempotencyKey,
      findings: response.findings,
      risk_score: response.risk_score ?? null,
      status: "success",
    });

    return {
      status: "success",
      findings: response.findings,
      riskScore: response.risk_score ?? 0,
      requestId: response.request_id ?? idempotencyKey,
      label: payload.data.label ?? undefined,
      detail:
        response.summary ??
        `Detected ${response.findings.length} potential matches.`,
    };
  } catch (error) {
    console.error("privacy.pii.scan", error);
    logAdminAction("privacy.pii.scan", {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
    await recordAuditEvent("privacy.pii.scan", {
      label: payload.success ? payload.data.label ?? null : null,
      error: error instanceof Error ? error.message : String(error),
      request_id: idempotencyKey,
    });
    return { status: "error", message: "Scan failed. Review telemetry for details." };
  }
}

export default function PrivacyPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <CardGlass title="Privacy requests" subtitle="Drive export and erasure via dedicated edge functions with audit logs.">
        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">Log subject request</h3>
            <ActionForm
              action={requestAction}
              submitLabel="Submit request"
              fields={[
                { name: "kind", label: "Kind", defaultValue: "export", placeholder: "export|erasure" },
                { name: "subject", label: "Subject user id", placeholder: "uuid", required: true },
                { name: "reason", label: "Reason", placeholder: "optional" },
              ]}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">Review decision</h3>
            <ActionForm
              action={reviewAction}
              submitLabel="Record decision"
              fields={[
                { name: "requestId", label: "Request id", placeholder: "uuid", required: true },
                { name: "decision", label: "Decision", defaultValue: "approve", placeholder: "approve|reject" },
                { name: "note", label: "Decision note", placeholder: "optional" },
              ]}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">Generate export</h3>
            <ActionForm
              action={exportAction}
              submitLabel="Start export"
              fields={[{ name: "requestId", label: "Request id", placeholder: "uuid", required: true }]}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">Erasure workflow</h3>
            <div className="space-y-4">
              <ActionForm
                action={planAction}
                submitLabel="Dry-run"
                fields={[{ name: "requestId", label: "Request id", placeholder: "uuid", required: true }]}
              />
              <ActionForm
                action={executeAction}
                submitLabel="Execute"
                fields={[
                  { name: "requestId", label: "Request id", placeholder: "uuid", required: true },
                  { name: "confirm", label: "Type ERASE to confirm", placeholder: "ERASE", required: true },
                ]}
              />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">PII detection</h3>
            <div className="space-y-4">
              <ActionForm<PIIScanState>
                action={piiScanAction}
                submitLabel="Scan text"
                pendingLabel="Scanning…"
                fields={[
                  { name: "label", label: "Label", placeholder: "ticket id or context" },
                  {
                    name: "content",
                    label: "Content",
                    type: "textarea",
                    placeholder: "Paste redaction candidate",
                    required: true,
                  },
                ]}
                renderStatus={(state) => <PIIScanStatus state={state} />}
                toastId="privacy-pii-scan"
                successTitle="Scan completed"
                errorTitle="Scan failed"
                offlineTitle="Auth required"
                defaultDescription="Use the regex stub for quick reviews while NLP is offline."
              />
            </div>
          </div>
        </div>
      </CardGlass>
      <CardGlass title="Policies" subtitle="RLS enforced with service-role only inside edge functions.">
        <p className="text-sm text-white/80">
          Privacy exports stream signed URLs to privacy_exports/ and audit events to privacy logs. Always verify request IDs,
          review decisions, and erasure confirmations before executing irreversible actions.
        </p>
      </CardGlass>
    </div>
  );
}

type PIIScanStatusProps = {
  state: PIIScanState;
};

function PIIScanStatus({ state }: PIIScanStatusProps) {
  if (state.status === "idle") return null;

  const tone = state.status === "success" ? "success" : state.status === "offline" ? "warning" : "error";
  const title =
    state.status === "success"
      ? "Scan completed"
      : state.status === "offline"
        ? "Auth required"
        : "Scan failed";
  const description = state.detail ?? state.message ?? "Review withObs logs for scan telemetry.";

  return (
    <div className="space-y-4">
      <Toast id={`privacy-pii-scan-${tone}`} title={title} description={description} onDismiss={() => undefined} />
      {state.status === "success" && state.findings ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60">{state.label ?? "Ad-hoc scan"}</p>
              <p className="text-white/80">{state.findings.length} findings</p>
            </div>
            <div className="text-right text-xs text-white/60">
              <p>Risk score: {(state.riskScore ?? 0).toFixed(2)}</p>
              {state.requestId ? <p>Request {state.requestId}</p> : null}
            </div>
          </div>
          <ul className="mt-3 space-y-2 text-xs text-white/70">
            {state.findings.map((finding, index) => (
              <li key={`${finding.type}-${finding.value}-${index}`} className="rounded-2xl border border-white/5 bg-black/20 p-3">
                <span className="font-semibold text-white">{finding.type.toUpperCase()}</span>
                <span className="ml-2 text-white/80">{finding.value}</span>
                {finding.context ? <span className="ml-2 text-white/50">({finding.context})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
