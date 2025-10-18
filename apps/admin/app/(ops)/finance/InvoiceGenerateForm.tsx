"use client";

import { useFormState, useFormStatus } from "react-dom";
import { buttonClassName, Toast } from "@ecotrips/ui";

type InvoiceFormState = {
  status: "idle" | "success" | "error" | "offline";
  message?: string;
  number?: string;
  signedUrl?: string;
};

const initialState: InvoiceFormState = { status: "idle" };

type InvoiceGenerateFormProps = {
  action: (state: InvoiceFormState, formData: FormData) => Promise<InvoiceFormState>;
};

export function InvoiceGenerateForm({ action }: InvoiceGenerateFormProps) {
  const [state, formAction] = useFormState(action, initialState);
  const { pending } = useFormStatus();

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-3">
        <label className="flex flex-col gap-2 text-sm">
          <span>Payment ID</span>
          <input
            name="paymentId"
            placeholder="payment UUID"
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span>Kind</span>
          <select
            name="kind"
            defaultValue="invoice"
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            <option value="invoice">Invoice</option>
            <option value="credit_note">Credit note</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span>Itinerary ID (optional)</span>
          <input
            name="itineraryId"
            placeholder="itinerary UUID"
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </label>
        <button type="submit" className={buttonClassName("glass")} disabled={pending}>
          {pending ? "Generating…" : "Generate invoice"}
        </button>
      </form>
      <InvoiceStatus state={state} />
    </div>
  );
}

type InvoiceStatusProps = { state: InvoiceFormState };

function InvoiceStatus({ state }: InvoiceStatusProps) {
  if (state.status === "idle") return null;

  const tone = state.status === "success" ? "success" : state.status === "offline" ? "warning" : "error";
  const description =
    state.status === "success"
      ? state.signedUrl
        ? `Signed URL ready: ${state.signedUrl}`
        : state.message
      : state.message ?? "Check withObs logs for details.";

  return (
    <Toast
      id={`finance-invoice-${tone}`}
      title={state.status === "success" ? `Invoice ${state.number ?? "ready"}` : state.status === "offline" ? "Auth required" : "Invoice failed"}
      description={description}
      onDismiss={() => undefined}
    />
  );
}
