import { BottomNavDock, CardGlass } from "@ecotrips/ui";
import type { BottomNavItem } from "@ecotrips/ui";

import { AutonomySettingsSheet } from "../components/AutonomySettingsSheet";

const navItems = [
  { href: "/", label: "Home", icon: "🏡" },
  { href: "/search", label: "Search", icon: "🔍" },
  { href: "/wallet", label: "Wallet", icon: "👛" },
  { href: "/support", label: "Support", icon: "💬" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
] as const satisfies readonly BottomNavItem[];

export default function SettingsPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-4 pb-32 pt-10">
      <CardGlass
        title="Autonomy controls"
        subtitle="Set agent autonomy per category and composer dial preferences."
      >
        <AutonomySettingsSheet />
      </CardGlass>
      <CardGlass
        title="Composer dial guidance"
        subtitle="Composer modes steer the conversation tone for the WhatsApp composer."
      >
        <ul className="list-disc space-y-2 pl-5 text-sm text-white/70">
          <li><strong>Observe</strong> keeps the composer in read-only mode for HITL review.</li>
          <li><strong>Assist</strong> suggests drafts while requiring confirmation.</li>
          <li><strong>Co-create</strong> alternates turns between traveller and agent.</li>
          <li><strong>Delegate</strong> allows proactive sends within the autonomy level.</li>
        </ul>
      </CardGlass>
      <BottomNavDock items={navItems} />
    </div>
  );
}
