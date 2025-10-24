"use client";

import { AdminActionForm, type AdminActionField, type AdminActionState, Toast } from "@ecotrips/ui";

export type InvoiceFormState = AdminActionState & {
  number?: string;
  signedUrl?: string;
};

const initialState: InvoiceFormState = { status: "idle" };

const fields: AdminActionField[] = [
  { name: "paymentId", label: "Payment ID", placeholder: "payment UUID" },
  {
    name: "kind",
    label: "Kind",
    type: "select",
    defaultValue: "invoice",
    options: [
      { value: "invoice", label: "Invoice" },
      { value: "credit_note", label: "Credit note" },
    ],
  },
  { name: "itineraryId", label: "Itinerary ID (optional)", placeholder: "itinerary UUID" },
];

type InvoiceGenerateFormProps = {
  action: (state: InvoiceFormState, formData: FormData) => Promise<InvoiceFormState>;
};

export function InvoiceGenerateForm({ action }: InvoiceGenerateFormProps) {
  return (
    <AdminActionForm
      action={action}
      initialState={initialState}
      submitLabel="Generate invoice"
      pendingLabel="Generating…"
      fields={fields}
      renderStatus={(state) => <InvoiceStatus state={state} />}
      toastId="finance-invoice"
      successTitle="Invoice ready"
      errorTitle="Invoice failed"
    />
  );
}

type InvoiceStatusProps = {
  state: InvoiceFormState;
};

function InvoiceStatus({ state }: InvoiceStatusProps) {
  if (state.status === "idle") return null;

  const tone = state.status === "success" ? "success" : state.status === "offline" ? "warning" : "error";
  const description =
    state.status === "success"
      ? state.signedUrl
        ? `Signed URL ready: ${state.signedUrl}`
        : state.message
      : state.message ?? "Check withObs logs for details.";

  const title =
    state.status === "success"
      ? `Invoice ${state.number ?? "ready"}`
      : state.status === "offline"
        ? "Auth required"
        : "Invoice failed";

  return <Toast id={`finance-invoice-${tone}`} title={title} description={description} onDismiss={() => undefined} />;
}
