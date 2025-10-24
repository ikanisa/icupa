import { CardGlass, Stepper, buttonClassName } from "@ecotrips/ui";
import Link from "next/link";

import { createPageMetadata } from "../../../lib/seo/metadata";
import { loadInventoryQuote } from "../../../lib/loaders/itinerary";
import { PublicPage } from "../../components/PublicPage";
import { QuoteHydrator } from "./QuoteHydrator";

export async function generateMetadata({ params }: { params: { id: string } }) {
  return createPageMetadata({
    title: `Itinerary ${params.id}`,
    description: "Review quote details, escrow steps, and checkout readiness.",
    path: `/itinerary/${params.id}`,
  });
}

export default async function ItineraryPage({ params }: { params: { id: string } }) {
  const quote = await loadInventoryQuote(params.id);

  const steps = [
    { id: "plan", label: "Plan", status: "complete" as const },
    { id: "group", label: "Group & Escrow", status: "current" as const },
    { id: "checkout", label: "Checkout", status: "pending" as const },
  ];

  return (
    <PublicPage>
      <QuoteHydrator quote={quote} />
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
      <PlannerFeatureGate
        debugLabel="itinerary.rhythm"
        fallback={
          <CardGlass title="Trip rhythm" subtitle="ConciergeGuide ensures daylight transfers and safety.">
            <Stepper steps={steps} />
          </CardGlass>
        }
      >
        <CardGlass title="Trip rhythm" subtitle="PlannerCoPilot ensures daylight transfers and safety.">
          <Stepper steps={steps} />
        </CardGlass>
      </PlannerFeatureGate>
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
    </PublicPage>
  );
}
