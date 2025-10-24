import { Badge, CardGlass, buttonClassName } from "@ecotrips/ui";

import { createPageMetadata } from "../../../lib/seo/metadata";
import { PublicPage } from "../components/PublicPage";
import { WalletOfflinePack } from "../components/WalletOfflinePack";
import { TripRecapCard } from "./TripRecapCard";

export default function WalletPage() {
  return (
    <PublicPage>
      <CardGlass title="Wallet" subtitle="Offline pack caches itinerary JSON, QR tickets, and emergency contacts.">
        <p className="text-sm text-white/80">
          Toggle INVENTORY_OFFLINE to force cached mode. Offline pack includes last synced itinerary, payment receipts, and WhatsApp emergency channels. Supply a privacy export request id to retrieve the signed offline bundle.
        </p>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Loyalty</Badge>
            <span className="font-medium text-white">Silver tier · 12,400 points</span>
          </div>
          <p className="mt-2 text-xs text-white/60">
            Loyalty balances hydrate from loyalty.accounts and ledger snapshots. Grant adjustments use the loyalty-grant edge function with idempotent request keys for ops review.
          </p>
        </div>
        <div className="mt-4 flex flex-col gap-4">
          <WalletOfflinePack />
          <a href="/support" className={buttonClassName("secondary")}>
            View invoices
          </a>
        </div>
      </CardGlass>
      <CardGlass
        title="Offline map tile packs"
        subtitle="Download Kigali and Akagera tiles for field navigation. Progress bars simulate bundle sync until live endpoints ship."
      >
        <TilePackDownloads />
      </CardGlass>
      <CardGlass title="Escrow contributions" subtitle="Track contributions and payouts from your wallet.">
        <ul className="space-y-2 text-sm text-white/80">
          <li>• Contributions recorded with ledger snapshots and WA notifications.</li>
          <li>• Partial payouts require FinOps HITL approval.</li>
        </ul>
      </CardGlass>
      <CardGlass title="Trip recap" subtitle="Generate recap email previews for partner demos.">
        <TripRecapCard />
      </CardGlass>
    </div>
  );
}
