import { CardGlass, buttonClassName } from "@ecotrips/ui";

import { createAdminServerClient } from "../../../lib/supabaseServer";
import B2BKeysPanel, { type B2BKeySummary } from "./B2BKeysPanel";

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

async function loadB2BKeys(): Promise<B2BKeySummary[]> {
  const supabase = await createAdminServerClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .schema("b2b")
    .from("api_keys")
    .select("id,name,status,scopes,key_prefix,created_at,last_used_at,usage_count,revoked_at,revoked_reason")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("b2b.api_keys", error);
    return [];
  }

  return Array.isArray(data)
    ? data.map((record) => ({
        id: record.id as string,
        name: (record.name as string) ?? "Unnamed key",
        status: (record.status as string) ?? "revoked",
        scopes: Array.isArray(record.scopes)
          ? record.scopes.filter((scope): scope is string => typeof scope === "string")
          : [],
        maskedKey: typeof record.key_prefix === "string"
          ? `${record.key_prefix}••••`
          : "••••",
        createdAt: (record.created_at as string) ?? new Date(0).toISOString(),
        lastUsedAt: (record.last_used_at as string | null) ?? null,
        usageCount: typeof record.usage_count === "number"
          ? record.usage_count
          : Number(record.usage_count ?? 0),
        revokedAt: (record.revoked_at as string | null) ?? null,
        revokedReason: (record.revoked_reason as string | null) ?? null,
      }))
    : [];
}

export default async function SettingsPage() {
  const [flags, apiKeys] = await Promise.all([loadFlags(), loadB2BKeys()]);
  return (
    <div className="space-y-8">
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
      <B2BKeysPanel initialKeys={apiKeys} />
    </div>
  );
}
