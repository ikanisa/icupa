import { CardGlass } from "@ecotrips/ui";
import { InvoiceGenerateInput } from "@ecotrips/types";

import { getOpsFunctionClient } from "../../../lib/functionClient";

import { InvoiceGenerateForm } from "./InvoiceGenerateForm";

type InvoiceFormState = {
  status: "idle" | "success" | "error" | "offline";
  message?: string;
  number?: string;
  signedUrl?: string;
};

async function generateInvoiceAction(_: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  "use server";

  const payload = InvoiceGenerateInput.safeParse({
    kind: String(formData.get("kind") ?? "invoice"),
    payment_id: String(formData.get("paymentId") ?? ""),
    itinerary_id: formData.get("itineraryId") ? String(formData.get("itineraryId")) : undefined,
  });

  if (!payload.success) {
    return { status: "error", message: "Provide valid payment and kind." };
  }

  const client = await getOpsFunctionClient();
  if (!client) {
    return { status: "offline", message: "Supabase session missing. Sign in again." };
  }

  try {
    const response = await client.call("fin.invoice.generate", payload.data);
    if (!response.ok) {
      return { status: "error", message: "Edge function reported failure." };
    }
    return {
      status: "success",
      number: response.number,
      signedUrl: response.signed_url,
      message: response.reused ? "Reused cached invoice" : undefined,
    };
  } catch (error) {
    console.error("fin.invoice.generate", error);
    return { status: "error", message: "Check withObs logs for error taxonomy." };
  }
}

export default function FinancePage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <CardGlass title="Finance ledger" subtitle="Invoices, refunds, and payouts recorded with HITL guardrails.">
        <p className="text-sm text-white/80">
          Generate invoices directly from ledger payments. Signed URLs are short-lived; store them in secure channels and audit
          every action using structured logs.
        </p>
        <InvoiceGenerateForm action={generateInvoiceAction} />
        <div className="rounded-2xl border border-white/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60">REF-104</p>
              <p className="text-white/80">Stripe refund request</p>
            </div>
            <div className="text-right text-xs text-white/60">
              <p>USD 860.00</p>
              <p>Pending HITL approval</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-white/60">Ledger entry append ensures audit trail and dual control.</p>
        </div>
      </CardGlass>
      <CardGlass title="Guardrails" subtitle="FinOps approvals require dual control and observability.">
        <ul className="space-y-2 text-sm text-white/80">
          <li>• payments-refund edge function logs structured telemetry with request IDs.</li>
          <li>• fin-ledger-append enforces allowed entry types and idempotency.</li>
          <li>• fin-invoice-generate writes signed URLs to Storage invoices/ bucket.</li>
        </ul>
      </CardGlass>
    </div>
  );
}
