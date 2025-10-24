import { CardGlass, buttonClassName } from "@ecotrips/ui";

import { createPageMetadata } from "../../../lib/seo/metadata";
import { PublicPage } from "../../components/PublicPage";
import { GroupEscrowActions } from "../../components/GroupEscrowActions";
import { GroupLiveSlotsPanel } from "../../components/GroupLiveSlotsPanel";

export async function generateMetadata({ params }: { params: { id: string } }) {
  return createPageMetadata({
    title: `Group escrow ${params.id}`,
    description: "Launch split-pay escrows, invite contributors, and sync payouts.",
    path: `/group/${params.id}`,
  });
}

export default function GroupPage({ params }: { params: { id: string } }) {
  return (
    <PublicPage>
      <CardGlass
        title="Split-pay escrow"
        subtitle={`Itinerary ${params.id}`}
        actions={
          <a href={`/checkout?id=${params.id}`} className={buttonClassName("glass")}>
            Continue to checkout
          </a>
        }
      >
        <p className="mb-6 text-sm text-white/80">
          Escrows require authentication so we serve fixtures until Supabase session tokens are present. Once connected you can orchestrate holds, invite contributors, and rely on idempotent payment intents with HITL safeguards.
        </p>
        <GroupEscrowActions itineraryId={params.id} />
      </CardGlass>
      <GroupLiveSlotsPanel itineraryId={params.id} />
      <CardGlass title="Invite flow" subtitle="WhatsApp invites share contributions link and due dates.">
        <p className="text-sm text-white/80">
          GroupBuilder agent tracks contributions and nudges participants. Idempotency keys guard duplicate payments. Admin HITL required before manual payouts.
        </p>
      </CardGlass>
    </PublicPage>
  );
}
