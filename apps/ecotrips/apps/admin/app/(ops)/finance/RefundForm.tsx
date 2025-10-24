"use client";

import { AdminActionForm, type AdminActionField, type AdminActionState, Toast } from "@ecotrips/ui";

export type RefundFormState = AdminActionState & {
  requestId?: string;
};

const initialState: RefundFormState = { status: "idle" };

const fields: AdminActionField[] = [
  { name: "itineraryId", label: "Itinerary ID", placeholder: "itinerary UUID", required: true },
  { name: "amount", label: "Amount", placeholder: "amount in currency (e.g. 85.00)", required: true },
  {
    name: "reason",
    label: "Reason",
    type: "textarea",
    placeholder: "customer cancellation",
    required: true,
  },
];

type RefundFormProps = {
  action: (state: RefundFormState, formData: FormData) => Promise<RefundFormState>;
};

export function RefundForm({ action }: RefundFormProps) {
  return (
    <AdminActionForm
      action={action}
      initialState={initialState}
      submitLabel="Submit refund"
      pendingLabel="Submitting…"
      fields={fields}
      renderStatus={(state) => <RefundStatus state={state} />}
      toastId="finance-refund"
      successTitle="Refund queued"
      errorTitle="Refund failed"
      offlineTitle="Auth required"
      defaultDescription="Review withObs logs for refund telemetry."
    />
  );
}

type RefundStatusProps = { state: RefundFormState };

function RefundStatus({ state }: RefundStatusProps) {
  if (state.status === "idle") return null;

  const tone = state.status === "success" ? "success" : state.status === "offline" ? "warning" : "error";
  const description =
    state.status === "success"
      ? state.message ?? (state.requestId ? `Request ID ${state.requestId}` : "Refund accepted")
      : state.message ?? "Review withObs logs for refund telemetry.";

  const title =
    state.status === "success"
      ? "Refund queued"
      : state.status === "offline"
        ? "Auth required"
        : "Refund failed";

  return <Toast id={`finance-refund-${tone}`} title={title} description={description} onDismiss={() => undefined} />;
}
