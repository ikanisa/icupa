import { CardGlass, buttonClassName } from "@ecotrips/ui";

const flags = [
  { key: "PAYMENT_MOCK", description: "Use mock payment providers for checkout smoke tests.", enabled: true },
  { key: "INVENTORY_OFFLINE", description: "Serve fixtures for inventory-search during supplier downtime.", enabled: false },
  { key: "WA_OFFLINE", description: "Switch WhatsApp flows to mock sender.", enabled: false },
];

export default function SettingsPage() {
  return (
    <CardGlass title="Feature flags" subtitle="Toggles backed by ops feature flag store.">
      <ul className="space-y-4 text-sm">
        {flags.map((flag) => (
          <li key={flag.key} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 p-4">
            <div>
              <p className="font-semibold">{flag.key}</p>
              <p className="text-white/70">{flag.description}</p>
            </div>
            <span className={buttonClassName(flag.enabled ? "glass" : "secondary")}>{flag.enabled ? "Enabled" : "Disabled"}</span>
          </li>
        ))}
      </ul>
    </CardGlass>
  );
}
