import { CardGlass } from "@ecotrips/ui";

import { SearchForm } from "../components/SearchForm";
import { PlannerFeatureGate } from "../components/PlannerFeatureGate";

export default function SearchPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-4 pb-24 pt-10">
      <CardGlass title="Search inventory" subtitle="Realtime inventory with offline fixtures when suppliers are offline.">
        <SearchForm />
      </CardGlass>
      <PlannerFeatureGate debugLabel="search.planner">
        <CardGlass title="PlannerCoPilot" subtitle="AI agents orchestrate search, quotes, and holds.">
          <p className="text-sm text-white/80">
            PlannerCoPilot uses inventory-search, inventory-quote, and inventory-hold edge functions to orchestrate reliable
            itineraries. All actions log to withObs for structured telemetry.
          </p>
        </CardGlass>
      </PlannerFeatureGate>
    </div>
  );
}
