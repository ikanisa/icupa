import { CardGlass, buttonClassName } from "@ecotrips/ui";

import { createAdminServerClient } from "../../../lib/supabaseServer";

async function loadFlags() {
  const supabase = await createAdminServerClient();
  if (!supabase) {
    return [] as Array<{ key: string; description: string; enabled: boolean }>;
  }

  const { data, error } = await supabase
    .from("ops.console_feature_flags")
    .select("key,description,enabled")
    .order("key");

  if (error) {
    console.error("ops.console_feature_flags", error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

export default async function SettingsPage() {
  const flags = await loadFlags();
  return (
    <CardGlass title="Feature flags" subtitle="Toggles backed by ops feature flag store.">
      {flags.length === 0 ? (
        <p className="text-sm text-white/70">No feature flags available. Verify ops.console_feature_flags table access.</p>
      ) : (
        <ul className="space-y-4 text-sm">
          {flags.map((flag) => (
            <li
              key={flag.key}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 p-4"
            >
              <div>
                <p className="font-semibold">{flag.key}</p>
                <p className="text-white/70">{flag.description}</p>
              </div>
              <span className={buttonClassName(flag.enabled ? "glass" : "secondary")}>
                {flag.enabled ? "Enabled" : "Disabled"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CardGlass>
  );
}
