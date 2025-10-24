import { CardGlass } from "@ecotrips/ui";
import type { PushDelivery } from "@ecotrips/types";

import pushDeliveryFixture from "../../../../../ops/fixtures/notification_delivery_logs.json" assert { type: "json" };
import recapFixture from "../../../../../ops/fixtures/trip_recaps.json" assert { type: "json" };

import { PushSendMock } from "./PushSendMock";
import { RecapEmailPreview } from "./RecapEmailPreview";
import { DeliveryLogTable } from "./DeliveryLogTable";

const deliveries = pushDeliveryFixture as PushDelivery[];
const recap = Array.isArray(recapFixture) && recapFixture.length > 0 ? recapFixture[0] : null;

export default function EngagementPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CardGlass title="Push send mock" subtitle="Demo push-subscribe/push-send flows with fixtures.">
        <p className="mb-4 text-sm text-white/80">
          Use the offline fixture to highlight how notifications fan out to search, wallet, and support segments. Logs stream
          to withObs for partner sign-off.
        </p>
        <PushSendMock deliveries={deliveries} />
      </CardGlass>
      <CardGlass title="Recap email preview" subtitle="Trip recap template pulled from fixture data.">
        {recap ? (
          <RecapEmailPreview
            subject={String(recap.subject ?? "Your ecoTrips recap")}
            summary={String(recap.summary ?? "Highlights from your ecoTrip.")}
            highlights={(recap.highlights as string[]) ?? []}
            previewHtml={String(recap.preview_html ?? "<p>Offline preview unavailable.</p>")}
            ctaUrl={String(recap.cta_url ?? "https://demo.ecotrips.app/wallet")}
          />
        ) : (
          <p className="text-sm text-white/70">No recap fixture found.</p>
        )}
      </CardGlass>
      <CardGlass title="Notification delivery logs" subtitle="Fixture-driven log table for partner demos." className="lg:col-span-2">
        <DeliveryLogTable deliveries={deliveries} />
      </CardGlass>
    </div>
  );
}
