import { LiquidGlassCard } from '@icupa/ui/liquid-glass-card';
import { FileText, Settings2, LineChart, ShieldCheck, Radar, Server, Bot } from 'lucide-react';

const panels = [
  {
    title: 'Onboarding & KYB',
    description: 'Supabase Edge Functions mint tenants, locations, agent defaults, and QR payloads gated by secrets.',
    icon: FileText,
  },
  {
    title: 'Agent Guardrails',
    description: 'Adjust instructions, tool allowlists, budgets, retrieval TTLs, and autonomy levels with JSON-backed controls.',
    icon: Settings2,
  },
  {
    title: 'Compliance & Fiscalization',
    description: 'Monitor fiscal SLAs, AI disclosures, GDPR exports, and kill-switches for fiscal endpoints.',
    icon: ShieldCheck,
  },
];

const metrics = [
  'GMV, AOV, attach rates (dessert target ≥ 12%)',
  'Prep SLA p95 ≤ 15 min, fiscal receipt latency ≤ 5 s',
  'AI hallucination audits ≤ 0.5%',
  'Budget caps and spend telemetry via agent_events',
];

export default function AdminSurfacePage() {
  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-4 text-white">
        <button className="self-start rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/60">
          Admin Console
        </button>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Operate with confidence—feature flags, budgets, analytics, and compliance at enterprise-grade.
        </h1>
        <p className="max-w-3xl text-sm text-white/70 sm:text-base">
          Admins orchestrate rollout, ensure fiscal coverage, and manage AI guardrails with full visibility across
          regions, tenants, and autonomy levels.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <LiquidGlassCard className="flex flex-col gap-6 bg-white/[0.12] p-8">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-white/60">
            <Bot className="h-4 w-4" />
            Governance surfaces
          </div>
          <div className="grid gap-5">
            {panels.map(({ title, description, icon: Icon }) => (
              <div key={title} className="flex items-start gap-4 rounded-3xl border border-white/10 bg-black/30 p-5">
                <Icon className="mt-1 h-6 w-6 flex-none text-white/70" />
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-white">{title}</h2>
                  <p className="text-sm text-white/70">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </LiquidGlassCard>

        <div className="flex flex-col gap-6">
          <LiquidGlassCard className="bg-white/[0.12] p-6">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-white/60">
              <LineChart className="h-4 w-4" />
              KPIs & Runbooks
            </div>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              {metrics.map((metric) => (
                <li key={metric} className="flex items-start gap-3">
                  <Radar className="mt-1 h-4 w-4 text-white/60" />
                  <span>{metric}</span>
                </li>
              ))}
            </ul>
          </LiquidGlassCard>

          <LiquidGlassCard className="bg-white/[0.12] p-6">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-white/60">
              <Server className="h-4 w-4" />
              Edge Functions & Env Catalog
            </div>
            <p className="mt-4 text-sm text-white/70">
              Supabase functions cover onboarding, payments, fiscalization, embeddings, and notifications. Secrets are
              scoped per environment across dev, staging, prod-EU, and prod-RW.
            </p>
          </LiquidGlassCard>
        </div>
      </div>
    </div>
  );
}
