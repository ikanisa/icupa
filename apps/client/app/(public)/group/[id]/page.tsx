import { CardGlass, buttonClassName } from "@ecotrips/ui";

import { GroupEscrowActions } from "../../components/GroupEscrowActions";
import { GroupLiveSlotsPanel } from "../../components/GroupLiveSlotsPanel";

export default function GroupPage({ params }: { params: { id: string } }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 pb-24 pt-10">
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
          Escrows require authentication so we serve fixtures until Supabase session tokens are present. Once connected you can
          orchestrate holds, invite contributors, and rely on idempotent payment intents with HITL safeguards.
        </p>
        <GroupEscrowActions itineraryId={params.id} />
      </CardGlass>
      <GroupLiveSlotsPanel itineraryId={params.id} />
      <CardGlass title="Invite flow" subtitle="WhatsApp invites share contributions link and due dates.">
        <p className="text-sm text-white/80">
          GroupBuilder agent tracks contributions and nudges participants. Idempotency keys guard duplicate payments. Admin HITL
          required before manual payouts.
        </p>
      </CardGlass>
    </div>
  );
}
