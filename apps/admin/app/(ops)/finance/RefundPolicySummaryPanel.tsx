"use client";

import { AdminActionForm, OptionCard, Toast, type AdminActionField, type AdminActionState } from "@ecotrips/ui";
import type { RefundPolicySummary } from "@ecotrips/types";

export type RefundPolicySummaryState = AdminActionState & {
  summary?: RefundPolicySummary;
  requestId?: string;
};

const initialState: RefundPolicySummaryState = { status: "idle" };

const fields: AdminActionField[] = [
  { name: "itineraryId", label: "Itinerary ID", placeholder: "itinerary UUID", required: true },
  {
    name: "policyText",
    label: "Override policy snippet",
    type: "textarea",
    placeholder: "Optional policy excerpt for offline review",
  },
];

type RefundPolicySummaryPanelProps = {
  action: (state: RefundPolicySummaryState, formData: FormData) => Promise<RefundPolicySummaryState>;
};

export function RefundPolicySummaryPanel({ action }: RefundPolicySummaryPanelProps) {
  return (
    <div className="space-y-4">
      <OptionForm action={action} />
    </div>
  );
}

function OptionForm({ action }: RefundPolicySummaryPanelProps) {
  return (
    <AdminActionForm<RefundPolicySummaryState>
      action={action}
      initialState={initialState}
      submitLabel="Summarize policy"
      pendingLabel="Summarizing…"
      fields={fields}
      renderStatus={(state) => <SummaryStatus state={state} />}
      toastId="refund-policy-summary"
      successTitle="Summary ready"
      errorTitle="Summary failed"
      offlineTitle="Auth required"
      defaultDescription="Review stub summary output from the edge function."
    />
  );
}

type SummaryStatusProps = {
  state: RefundPolicySummaryState;
};

function SummaryStatus({ state }: SummaryStatusProps) {
  if (state.status === "idle") return null;

  const tone = state.status === "success" ? "success" : state.status === "offline" ? "warning" : "error";
  const title = state.status === "success" ? "Summary ready" : state.status === "offline" ? "Auth required" : "Summary failed";
  const description = state.detail ?? state.message ?? "Review withObs logs for summary telemetry.";

  return (
    <div className="space-y-4">
      <Toast id={`refund-policy-summary-${tone}`} title={title} description={description} onDismiss={() => undefined} />
      {state.status === "success" && state.summary ? (
        <OptionCard
          title={state.summary.title ?? "Refund policy assessment"}
          description={state.summary.context}
          riskLevel={state.summary.risk_grade}
          highlights={state.summary.highlights}
          actions={state.summary.actions}
          meta={state.requestId ? `Request ${state.requestId}` : undefined}
          triggerLabel="View highlights"
          modalTitle="Refund policy breakdown"
        />
      ) : null}
    </div>
  );
}
