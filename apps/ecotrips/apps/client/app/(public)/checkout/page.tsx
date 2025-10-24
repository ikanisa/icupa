import { CardGlass } from "@ecotrips/ui";

import { createPageMetadata } from "../../../lib/seo/metadata";
import { PublicPage } from "../components/PublicPage";
import { CheckoutForm } from "../components/CheckoutForm";

export const metadata = createPageMetadata({
  title: "Checkout",
  description: "Create idempotent payment intents and ledger-backed invoices for your itinerary.",
  path: "/checkout",
});

export default function CheckoutPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const itineraryId = typeof searchParams.id === "string" ? searchParams.id : "draft";

  return (
    <PublicPage>
      <CardGlass
        title="Checkout"
        subtitle="Idempotent payment intents with ledger + invoice generation."
      >
        <CheckoutForm itineraryId={itineraryId} />
      </CardGlass>
      <CardGlass title="Ledger & invoices" subtitle="bff-checkout pairs with fin-ledger-append and fin-invoice-generate.">
        <p className="text-sm text-white/80">
          Payments default to PAYMENT_MOCK in preview; production uses Stripe/MTN MoMo with HITL approvals. Idempotency keys ensure safe retries.
        </p>
      </CardGlass>
    </PublicPage>
  );
}
