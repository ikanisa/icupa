import { CardGlass, buttonClassName } from "@ecotrips/ui";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminServerClient } from "../../../lib/supabaseServer";
import { logAdminAction } from "../../../lib/logging";
import { getOpsFunctionClient } from "../../../lib/functionClient";

const BadgeSchema = z.object({
  supplierSlug: z.string().min(1).max(120),
  code: z.string().min(1).max(120),
  label: z.string().min(1).max(160),
  description: z.string().min(1).max(240).optional(),
});

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

async function loadBadges() {
  const supabase = await createAdminServerClient();
  if (!supabase) {
    return [] as Array<{
      id: string;
      supplier_slug: string;
      code: string;
      label: string;
      description: string | null;
      active: boolean;
      created_at: string;
    }>;
  }

  const { data, error } = await supabase
    .from("trust_badges")
    .select("id,supplier_slug,code,label,description,active,created_at")
    .order("supplier_slug")
    .order("code");

  if (error) {
    console.error("trust_badges", error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

export default async function SettingsPage({ searchParams }: { searchParams?: Record<string, string | string[]> }) {
  const [flags, badges] = await Promise.all([loadFlags(), loadBadges()]);
  const synthSummary = typeof searchParams?.synth === "string" ? searchParams?.synth : null;
  const synthStatus = typeof searchParams?.synthStatus === "string" ? searchParams?.synthStatus : null;
  const synthResults = synthSummary
    ? synthSummary.split(",").map((pair) => {
        const [key, value] = pair.split(":");
        return { key, count: Number.parseInt(value ?? "0", 10) || 0 };
      })
    : [];

  return (
    <div className="space-y-6">
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

      <CardGlass
        title="Supplier trust badges"
        subtitle="Badges render on marketing pages and supplier orders with tooltip copy."
      >
        <form action={addBadgeAction} className="grid gap-3 rounded-2xl border border-white/10 p-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wide text-white/60">Supplier slug</span>
              <input
                name="supplierSlug"
                placeholder="aurora-expeditions"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-emerald-300 focus:outline-none"
                required
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wide text-white/60">Code</span>
              <input
                name="code"
                placeholder="gstc"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-emerald-300 focus:outline-none"
                required
              />
            </label>
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-white/60">Label</span>
            <input
              name="label"
              placeholder="Global Sustainable Tourism Council member"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-emerald-300 focus:outline-none"
              required
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-white/60">Tooltip</span>
            <textarea
              name="description"
              placeholder="Explain why the badge builds trust for operators and travelers."
              className="min-h-[72px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-emerald-300 focus:outline-none"
            />
          </label>
          <div className="flex justify-end">
            <button type="submit" className={buttonClassName("glass")}>
              Add badge
            </button>
          </div>
        </form>

        {badges.length === 0 ? (
          <p className="text-sm text-white/70">No badges recorded yet. Add one using the form above.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {badges.map((badge) => (
              <li
                key={badge.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
                title={badge.description ?? undefined}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-white">{badge.label}</p>
                    <p className="text-xs uppercase tracking-wide text-white/50">{badge.supplier_slug} · {badge.code}</p>
                  </div>
                  <span className={buttonClassName(badge.active ? "glass" : "secondary")}>
                    {badge.active ? "Active" : "Archived"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-white/70">{badge.description ?? "No tooltip provided."}</p>
              </li>
            ))}
          </ul>
        )}
      </CardGlass>

      <CardGlass
        title="Synthetic fixture seeding"
        subtitle="Trigger admin.synth.generate to backfill preview fixtures."
      >
        {synthStatus ? (
          <p className="text-sm text-white/70">{renderSynthStatus(synthStatus)}</p>
        ) : (
          <p className="text-sm text-white/70">Generate fixtures for preview deployments. Counts reflect fixture payloads.</p>
        )}
        {synthResults.length > 0 && (
          <ul className="mt-3 space-y-2 text-sm">
            {synthResults.map((item) => (
              <li key={item.key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <span className="font-semibold text-white">{item.key}</span>
                <span className="text-white/70">{item.count} rows</span>
              </li>
            ))}
          </ul>
        )}
        <form action={runSynthAction} className="mt-4 flex justify-end">
          <button type="submit" className={buttonClassName("glass")}>Seed fixtures</button>
        </form>
      </CardGlass>
    </div>
  );
}

async function addBadgeAction(formData: FormData) {
  "use server";

  const parsed = BadgeSchema.safeParse({
    supplierSlug: String(formData.get("supplierSlug") ?? "").trim().toLowerCase(),
    code: String(formData.get("code") ?? "").trim().toLowerCase(),
    label: String(formData.get("label") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
  });

  if (!parsed.success) {
    logAdminAction("settings.badges.insert", { status: "validation_failed" });
    return;
  }

  const supabase = await createAdminServerClient();
  if (!supabase) {
    logAdminAction("settings.badges.insert", { status: "offline" });
    return;
  }

  const { error } = await supabase.from("trust_badges").insert({
    supplier_slug: parsed.data.supplierSlug,
    code: parsed.data.code,
    label: parsed.data.label,
    description: parsed.data.description ?? null,
    active: true,
  });

  if (error) {
    console.error("trust_badges.insert", error);
    logAdminAction("settings.badges.insert", { status: "error", code: parsed.data.code });
    return;
  }

  logAdminAction("settings.badges.insert", {
    status: "success",
    supplierSlug: parsed.data.supplierSlug,
    code: parsed.data.code,
  });
  revalidatePath("/settings");
}


async function runSynthAction() {
  "use server";

  const client = await getOpsFunctionClient();
  if (!client) {
    logAdminAction("settings.synth.generate", { status: "offline" });
    redirect("/settings?synthStatus=offline");
  }

  try {
    const response = await client.call("admin.synth.generate", {});
    if (!response.ok) {
      logAdminAction("settings.synth.generate", { status: "error", requestId: response.request_id });
      redirect(`/settings?synthStatus=error&requestId=${response.request_id ?? ""}`);
    }
    const seeded = Array.isArray(response.seeded) ? response.seeded : [];
    const summary = seeded
      .map((item) => `${item.key}:${item.count ?? 0}`)
      .join(",");
    logAdminAction("settings.synth.generate", { status: "success", seeded });
    redirect(`/settings?synthStatus=success&synth=${encodeURIComponent(summary)}&requestId=${response.request_id ?? ""}`);
  } catch (error) {
    console.error("admin.synth.generate", error);
    logAdminAction("settings.synth.generate", { status: "error" });
    redirect("/settings?synthStatus=error");
  }
}

function renderSynthStatus(status: string): string {
  switch (status) {
    case "success":
      return "Synthetic fixtures seeded successfully.";
    case "offline":
      return "Unable to reach admin.synth.generate — check Supabase session.";
    case "error":
      return "Fixture seeding failed. Check logs for details.";
    default:
      return status;
  }
}
