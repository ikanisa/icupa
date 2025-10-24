import { CardGlass, Stepper, buttonClassName } from "@ecotrips/ui";
import { createEcoTripsFunctionClient } from "@ecotrips/api";
import Link from "next/link";
import { AutoBalanceDayControl } from "./AutoBalanceDayControl";

import { PlannerFeatureGate } from "../../components/PlannerFeatureGate";

async function loadQuote(id: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return { ok: false, quote: null };

  const client = createEcoTripsFunctionClient({
    supabaseUrl,
    anonKey,
    getAccessToken: async () => null,
  });

  try {
    const response = await client.call("inventory.quote", { quoteId: id, locale: "en" });
    return response;
  } catch (error) {
    console.error("inventory.quote failed", error);
    return { ok: false, quote: null };
  }
}

export default async function ItineraryPage({ params }: { params: { id: string } }) {
  const quote = await loadQuote(params.id);

  const steps = [
    { id: "plan", label: "Plan", status: "complete" as const },
    { id: "group", label: "Group & Escrow", status: "current" as const },
    { id: "checkout", label: "Checkout", status: "pending" as const },
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 pb-24 pt-10">
      <CardGlass
        title="Itinerary"
        subtitle={`Quote ${params.id}`}
        actions={
          <Link href={`/checkout?id=${params.id}`} className={buttonClassName("glass")}>
            Proceed to checkout
          </Link>
        }
      >
        {quote.quote ? (
          <div className="space-y-3 text-sm text-white/80">
            <p>{quote.quote.summary ?? "Eco-friendly highlights across Rwanda"}</p>
            <p>Price locked until {quote.quote.expires_at ?? "soon"}.</p>
          </div>
        ) : (
          <p className="text-sm text-white/80">
            Quote details pending. We maintain holds via inventory-hold for 15 minutes with idempotency keys.
          </p>
        )}
      </CardGlass>
      <CardGlass title="Trip rhythm" subtitle="PlannerCoPilot ensures daylight transfers and safety.">
        <Stepper steps={steps} />
      </CardGlass>
      <CardGlass
        title="Day optimizer"
        subtitle="Resolve itinerary conflicts before handing bundles to Supabase agents."
      >
        <AutoBalanceDayControl />
      </CardGlass>
      <CardGlass title="Group planning" subtitle="Spin up split-pay escrows and WhatsApp invites.">
        <div className="flex flex-wrap gap-3">
          <Link href={`/group/${params.id}`} className={buttonClassName()}>
            Create escrow
          </Link>
          <Link href={`/group/${params.id}?share=1`} className={buttonClassName("secondary")}>
            Share itinerary
          </Link>
        </div>
      </CardGlass>
    </div>
  );
}
