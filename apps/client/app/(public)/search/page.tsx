import { CardGlass } from "@ecotrips/ui";

import { createPageMetadata } from "../../../lib/seo/metadata";
import { PublicPage } from "../components/PublicPage";
import { SearchForm } from "../components/SearchForm";
import { PushNotificationBanner } from "../components/PushNotificationBanner";

export default function SearchPage() {
  return (
    <PublicPage gapClass="gap-8">
      <CardGlass title="Search inventory" subtitle="Realtime inventory with offline fixtures when suppliers are offline.">
        <SearchForm />
      </CardGlass>
      <PushNotificationBanner context="search" tags={["search"]} />
      <CardGlass title="PlannerCoPilot" subtitle="AI agents orchestrate search, quotes, and holds.">
        <p className="text-sm text-white/80">
          PlannerCoPilot uses inventory-search, inventory-quote, and inventory-hold edge functions to orchestrate reliable
          itineraries. All actions log to withObs for structured telemetry.
        </p>
      </CardGlass>
    </PublicPage>
  );
}
