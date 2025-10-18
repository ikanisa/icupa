import { CardGlass } from "@ecotrips/ui";
import {
  PrivacyErasureExecuteInput,
  PrivacyErasurePlanInput,
  PrivacyExportInput,
  PrivacyRequestInput,
  PrivacyReviewInput,
} from "@ecotrips/types";

import { getOpsFunctionClient } from "../../../lib/functionClient";

import { ActionForm, type ActionFormState } from "./ActionForm";

type ServerState = ActionFormState;

async function requestAction(_: ServerState, formData: FormData): Promise<ServerState> {
  "use server";

  const payload = PrivacyRequestInput.safeParse({
    kind: String(formData.get("kind") ?? "export").toLowerCase(),
    subject_user_id: String(formData.get("subject") ?? ""),
    reason: formData.get("reason") ? String(formData.get("reason")) : undefined,
  });

  if (!payload.success) {
    return { status: "error", message: "Valid subject UUID required." };
  }

  const client = await getOpsFunctionClient();
  if (!client) {
    return { status: "offline", message: "Supabase session missing." };
  }

  try {
    const response = await client.call("privacy.request", payload.data);
    if (!response.ok || !response.request_id) {
      return { status: "error", message: "Edge function reported failure." };
    }
    return { status: "success", detail: `Request ${response.request_id}` };
  } catch (error) {
    console.error("privacy.request", error);
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
    return { status: "error", message: "Provide request id and decision." };
  }

  const client = await getOpsFunctionClient();
  if (!client) {
    return { status: "offline", message: "Supabase session missing." };
  }

  try {
    const response = await client.call("privacy.review", payload.data);
    if (!response.ok) {
      return { status: "error", message: "Review failed." };
    }
    return { status: "success", detail: `Request now ${response.status ?? "updated"}` };
  } catch (error) {
    console.error("privacy.review", error);
    return { status: "error", message: "Check withObs taxonomy for details." };
  }
}

async function exportAction(_: ServerState, formData: FormData): Promise<ServerState> {
  "use server";

  const payload = PrivacyExportInput.safeParse({ request_id: String(formData.get("requestId") ?? "") });
  if (!payload.success) {
    return { status: "error", message: "Request id required." };
  }

  const client = await getOpsFunctionClient();
  if (!client) {
    return { status: "offline", message: "Supabase session missing." };
  }

  try {
    const response = await client.call("privacy.export", payload.data);
    if (!response.ok) {
      return { status: "error", message: "Export failed." };
    }
    return {
      status: "success",
      detail: response.signed_url ? `Signed URL ready: ${response.signed_url}` : "Export queued",
    };
  } catch (error) {
    console.error("privacy.export", error);
    return { status: "error", message: "Check withObs taxonomy for details." };
  }
}

async function planAction(_: ServerState, formData: FormData): Promise<ServerState> {
  "use server";

  const payload = PrivacyErasurePlanInput.safeParse({ request_id: String(formData.get("requestId") ?? "") });
  if (!payload.success) {
    return { status: "error", message: "Request id required." };
  }

  const client = await getOpsFunctionClient();
  if (!client) {
    return { status: "offline", message: "Supabase session missing." };
  }

  try {
    const response = await client.call("privacy.erasure.plan", payload.data);
    if (!response.ok) {
      return { status: "error", message: "Plan generation failed." };
    }
    return {
      status: "success",
      detail: response.signed_url ? `Plan ready: ${response.signed_url}` : "Dry-run completed",
    };
  } catch (error) {
    console.error("privacy.erasure.plan", error);
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
    return { status: "error", message: "Confirm with ERASE and provide request id." };
  }

  const client = await getOpsFunctionClient();
  if (!client) {
    return { status: "offline", message: "Supabase session missing." };
  }

  try {
    const response = await client.call("privacy.erasure.execute", payload.data);
    if (!response.ok) {
      return { status: "error", message: "Erasure execution failed." };
    }
    return {
      status: "success",
      detail: response.summary ? `Tables affected: ${response.summary.length}` : "Erasure completed",
    };
  } catch (error) {
    console.error("privacy.erasure.execute", error);
    return { status: "error", message: "Check withObs taxonomy for details." };
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
