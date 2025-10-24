"use client";

import { AdminActionForm, type AdminActionField, type AdminActionState, Toast } from "@ecotrips/ui";

export type PayoutFormState = AdminActionState & {
  requestId?: string;
};

const initialState: PayoutFormState = { status: "idle" };

const baseFields: AdminActionField[] = [
  { name: "escrowId", label: "Escrow ID", placeholder: "uuid for group escrow" },
];

type TriggerPayoutFormProps = {
  action: (state: PayoutFormState, formData: FormData) => Promise<PayoutFormState>;
  lastEscrowId?: string;
};

export function TriggerPayoutForm({ action, lastEscrowId }: TriggerPayoutFormProps) {
  const fields: AdminActionField[] = lastEscrowId
    ? [{ ...baseFields[0], defaultValue: lastEscrowId }]
    : baseFields;

  return (
    <AdminActionForm
      action={action}
      initialState={initialState}
      submitLabel="Trigger payout"
      pendingLabel="Triggering payout…"
      fields={fields}
      renderStatus={(state) => <PayoutStatus state={state} />}
      toastId="groups-payout"
      successTitle="Payout orchestrated"
      errorTitle="Payout failed"
      offlineTitle="Auth required"
      defaultDescription="Check withObs logs for request telemetry."
    />
  );
}

type PayoutStatusProps = { state: PayoutFormState };

function PayoutStatus({ state }: PayoutStatusProps) {
  if (state.status === "idle") {
    return null;
  }

  const tone = state.status === "success" ? "success" : state.status === "offline" ? "warning" : "error";
  const description = state.message ?? "Check withObs logs for request telemetry.";
  const title =
    state.status === "success"
      ? state.requestId
        ? `Payout queued (${state.requestId})`
        : "Payout orchestrated"
      : state.status === "offline"
        ? "Auth required"
        : "Payout failed";

  return <Toast id={`groups-payout-${tone}`} title={title} description={description} onDismiss={() => undefined} />;
}
