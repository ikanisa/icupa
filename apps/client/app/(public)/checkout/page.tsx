import { CardGlass } from "@ecotrips/ui";

import { CheckoutForm } from "../components/CheckoutForm";

export default function CheckoutPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const itineraryId = typeof searchParams.id === "string" ? searchParams.id : "draft";

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 pb-24 pt-10">
      <CardGlass
        title="Checkout"
        subtitle="Idempotent payment intents with ledger + invoice generation."
      >
        <CheckoutForm itineraryId={itineraryId} />
      </CardGlass>
      <CardGlass title="Ledger & invoices" subtitle="bff-checkout pairs with fin-ledger-append and fin-invoice-generate.">
        <p className="text-sm text-white/80">
          Payments default to PAYMENT_MOCK in preview; production uses Stripe/MTN MoMo with HITL approvals. Idempotency keys
          ensure safe retries.
        </p>
      </CardGlass>
    </div>
  );
}
