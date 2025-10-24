import { CardGlass } from "@ecotrips/ui";

import { createPageMetadata } from "../../../lib/seo/metadata";
import { PublicPage } from "../components/PublicPage";
import { SearchForm } from "../components/SearchForm";
import { PlannerFeatureGate } from "../components/PlannerFeatureGate";

export const metadata = createPageMetadata({
  title: "Search",
  description: "Search inventory via Supabase edge functions with offline-first resilience.",
  path: "/search",
});

export default function SearchPage() {
  return (
    <PublicPage gapClass="gap-8">
      <CardGlass title="Search inventory" subtitle="Realtime inventory with offline fixtures when suppliers are offline.">
        <SearchForm />
      </CardGlass>
      <CardGlass title="PlannerCoPilot" subtitle="AI agents orchestrate search, quotes, and holds.">
        <p className="text-sm text-white/80">
          PlannerCoPilot uses inventory-search, inventory-quote, and inventory-hold edge functions to orchestrate reliable
          itineraries. All actions log to withObs for structured telemetry.
        </p>
      </CardGlass>
    </PublicPage>
  );
}
