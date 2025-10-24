import type { Metadata } from "next";
import Link from "next/link";

import { IntakeForm } from "../components/IntakeForm";

export const metadata: Metadata = {
  title: "Intake | ecoTrips Ops",
  description:
    "Atlas-styled intake workflow for capturing ecoTrips traveler requirements before proposal drafting.",
};

export default function IntakePage() {
  return (
    <div className="card" style={{ display: "grid", gap: 24 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <Link href="/" className="btn" style={{ width: "fit-content", paddingInline: 14, paddingBlock: 8 }}>
          ← Back to home
        </Link>
        <div className="badge" style={{ width: "fit-content" }}>
          Intake workflow
        </div>
        <h1 className="h1" id="intake-form-heading" style={{ marginBottom: 4 }}>
          Capture traveler requirements
        </h1>
        <p className="subtle" style={{ maxWidth: 520 }}>
          Gather the essentials your operators need to craft a low-impact itinerary: traveler counts, accessibility requests,
          program themes, and goals for measurable sustainability outcomes.
        </p>
      </div>

      <IntakeForm />
    </div>
  );
}
