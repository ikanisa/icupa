import { LiquidGlassCard } from '@icupa/ui/liquid-glass-card';
import { ClipboardList, LayoutDashboard, Radar, Gauge, FlaskConical } from 'lucide-react';

const streams = [
  {
    title: 'Kitchen Display (KDS)',
    copy: 'Realtime Supabase channels triage cook times, pacing, and runner assignments.',
  },
  {
    title: 'Floor orchestration',
    copy: 'Table states flow from vacant → ordering → served → cleaning with agent nudges when SLAs slip.',
  },
  {
    title: 'Inventory auto-86',
    copy: 'Threshold-based 86ing with agent-assisted substitutions and notifications to floor staff.',
  },
];

const levers = ['Promo epsilon bandits', 'Caps & fairness guards', 'Agent autonomy controls', 'Spend dashboards'];

export default function MerchantSurfacePage() {
  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-4 text-white">
        <button className="self-start rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/60">
          Merchant Portal
        </button>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Keep the floor orchestrated with AI-assisted pacing, inventory truth, and promo bandits you control.
        </h1>
        <p className="max-w-3xl text-sm text-white/70 sm:text-base">
          Operators gain a real-time control room: KDS dashboards, table states, inventory automation, and promo
          experimentation managed by explicit budget guardrails.
        </p>
      </header>

      <LiquidGlassCard className="grid gap-8 bg-white/[0.12] p-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-white/60">
            <LayoutDashboard className="h-4 w-4" />
            Command surfaces
          </div>
          <div className="grid gap-4">
            {streams.map((stream) => (
              <div key={stream.title} className="rounded-3xl border border-white/10 bg-black/30 p-5">
                <h2 className="text-lg font-semibold text-white">{stream.title}</h2>
                <p className="mt-2 text-sm text-white/70">{stream.copy}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
            <h3 className="text-sm uppercase tracking-[0.3em] text-white/60">Agent levers</h3>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              {levers.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <Gauge className="h-4 w-4 text-white/60" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
            <h3 className="text-sm uppercase tracking-[0.3em] text-white/60">Observability</h3>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              <li className="flex items-center gap-3">
                <ClipboardList className="h-4 w-4 text-white/60" />
                <span>OpenTelemetry traces + structured logs</span>
              </li>
              <li className="flex items-center gap-3">
                <Radar className="h-4 w-4 text-white/60" />
                <span>SLO dashboards: prep SLA, attach rates, AI fatigue</span>
              </li>
              <li className="flex items-center gap-3">
                <FlaskConical className="h-4 w-4 text-white/60" />
                <span>Experiment matrix with epsilon bandits</span>
              </li>
            </ul>
          </div>
        </div>
      </LiquidGlassCard>
    </div>
  );
}
