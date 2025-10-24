import { CardGlass, ExplainPrice } from "@ecotrips/ui";
import { InvoiceGenerateInput, type PriceBreakdown } from "@ecotrips/types";
import { z } from "zod";

import { getOpsFunctionClient } from "../../../lib/functionClient";
import { logAdminAction } from "../../../lib/logging";

import { InvoiceGenerateForm, type InvoiceFormState } from "./InvoiceGenerateForm";
import { RefundForm, type RefundFormState } from "./RefundForm";

async function generateInvoiceAction(_: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  "use server";

  const payload = InvoiceGenerateInput.safeParse({
    kind: String(formData.get("kind") ?? "invoice"),
    payment_id: String(formData.get("paymentId") ?? ""),
    itinerary_id: formData.get("itineraryId") ? String(formData.get("itineraryId")) : undefined,
  });

  if (!payload.success) {
    logAdminAction("finance.invoice.generate", { status: "validation_failed" });
    return { status: "error", message: "Provide valid payment and kind." };
  }

  const client = await getOpsFunctionClient();
  if (!client) {
    logAdminAction("finance.invoice.generate", { status: "offline" });
    return { status: "offline", message: "Supabase session missing. Sign in again." };
  }

  try {
    const response = await client.call("fin.invoice.generate", payload.data);
    if (!response.ok) {
      logAdminAction("finance.invoice.generate", { status: "error", requestId: response.request_id });
      return { status: "error", message: "Edge function reported failure." };
    }
    logAdminAction("finance.invoice.generate", {
      status: "success",
      requestId: response.request_id,
      invoiceNumber: response.number,
      reused: response.reused ?? false,
    });
    return {
      status: "success",
      number: response.number,
      signedUrl: response.signed_url,
      message: response.reused ? "Reused cached invoice" : undefined,
    };
  } catch (error) {
    console.error("fin.invoice.generate", error);
    logAdminAction("finance.invoice.generate", { status: "error", error: error instanceof Error ? error.message : String(error) });
    return { status: "error", message: "Check withObs logs for error taxonomy." };
  }
}

const RefundFormSchema = z.object({
  itineraryId: z.string().uuid(),
  amount: z.string().min(1),
  reason: z.string().min(1).max(200),
});

async function submitRefundAction(_: RefundFormState, formData: FormData): Promise<RefundFormState> {
  "use server";

  const parsed = RefundFormSchema.safeParse({
    itineraryId: String(formData.get("itineraryId") ?? "").trim(),
    amount: String(formData.get("amount") ?? "").trim(),
    reason: String(formData.get("reason") ?? "").trim(),
  });

  if (!parsed.success) {
    logAdminAction("finance.refund", { status: "validation_failed" });
    return { status: "error", message: "Provide itinerary, amount, and reason." };
  }

  const normalizedAmount = parsed.data.amount.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/u.test(normalizedAmount)) {
    logAdminAction("finance.refund", { status: "validation_failed", detail: "amount_format" });
    return { status: "error", message: "Amount must be a positive number with up to two decimals." };
  }

  const amountValue = Number.parseFloat(normalizedAmount);
  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    logAdminAction("finance.refund", { status: "validation_failed", detail: "amount_value" });
    return { status: "error", message: "Amount must be greater than zero." };
  }

  const amountCents = Math.round(amountValue * 100);

  const client = await getOpsFunctionClient();
  if (!client) {
    logAdminAction("finance.refund", { status: "offline" });
    return { status: "offline", message: "Supabase session missing. Sign in again." };
  }

  try {
    const response = await client.call("ops.refund", {
      itinerary_id: parsed.data.itineraryId,
      amount_cents: amountCents,
      reason: parsed.data.reason,
    });
    if (!response.ok) {
      logAdminAction("finance.refund", { status: "error", requestId: response.request_id });
      return { status: "error", message: "Refund request failed." };
    }
    logAdminAction("finance.refund", {
      status: "success",
      requestId: response.request_id,
      itineraryId: parsed.data.itineraryId,
      amountCents,
    });
    return {
      status: "success",
      requestId: response.request_id,
      message: response.message ?? "Refund queued",
    };
  } catch (error) {
    console.error("ops.refund", error);
    logAdminAction("finance.refund", { status: "error", error: error instanceof Error ? error.message : String(error) });
    return { status: "error", message: "Check withObs logs for refund telemetry." };
  }
}

async function loadFinanceBreakdown(): Promise<PriceBreakdown | null> {
  const client = await getOpsFunctionClient();
  if (!client) {
    return null;
  }

  try {
    const response = await client.call("helpers.price", { option_ids: ["ledger-ref-104"] });
    if (!response.ok) {
      return null;
    }
    return response.breakdowns?.[0]?.breakdown ?? null;
  } catch (error) {
    console.error("helpers.price finance", error);
    return null;
  }
}

export default async function FinancePage() {
  const financeBreakdown = await loadFinanceBreakdown();

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <CardGlass title="Finance ledger" subtitle="Invoices, refunds, and payouts recorded with HITL guardrails.">
        <p className="text-sm text-white/80">
          Generate invoices directly from ledger payments. Signed URLs are short-lived; store them in secure channels and audit
          every action using structured logs.
        </p>
        <InvoiceGenerateForm action={generateInvoiceAction} />
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/60">Submit refund</h3>
          <RefundForm action={submitRefundAction} />
        </div>
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
        {financeBreakdown && (
          <div className="mt-6">
            <ExplainPrice breakdown={financeBreakdown} headline="REF-104 pricing" />
          </div>
        )}
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
