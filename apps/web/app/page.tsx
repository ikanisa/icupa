import Link from 'next/link';
import { ArrowRight, Sparkles, ShieldCheck, Bot } from 'lucide-react';
import { LiquidGlassCard } from '@icupa/ui/liquid-glass-card';

const surfaces = [
  {
    href: '/client',
    title: 'Client Surface',
    description: 'Menu exploration, allergen transparency, AI concierge, and seamless checkout.',
    chips: ['Menu', 'Cart', 'Pay', 'AI Waiter'],
  },
  {
    href: '/merchant',
    title: 'Merchant Portal',
    description: 'KDS, floor orchestration, inventory 86ing, and promo bandits at your fingertips.',
    chips: ['KDS', 'Floor', 'Inventory', 'Promos'],
  },
  {
    href: '/admin',
    title: 'Admin Console',
    description: 'Tenant onboarding, AI guardrails, analytics, compliance, and fiscalization runbooks.',
    chips: ['Onboarding', 'Agents', 'Analytics', 'Compliance'],
  },
];

export default function HomePage() {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-6 text-white">
        <span className="section-title">ICUPA PLATFORM</span>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Multi-surface dine-in experiences for Rwanda and Malta, crafted to be agent-ready from day one.
        </h1>
        <p className="max-w-3xl text-lg text-white/70">
          Client PWAs blend semantic search, push receipts, and allergy guardrails. Merchants gain real-time pacing,
          inventory insights, and promo autonomy. Admins orchestrate budgets, compliance, and AI guardrails with full
          observability.
        </p>
        <div className="flex flex-wrap items-center gap-4 text-sm text-white/70">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2">
            <Sparkles className="h-4 w-4" /> pgvector semantic search
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2">
            <Bot className="h-4 w-4" /> OpenAI Agents SDK
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2">
            <ShieldCheck className="h-4 w-4" /> RLS, kill switches, fiscalization stubs
          </span>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {surfaces.map((surface) => (
          <LiquidGlassCard key={surface.href} className="flex h-full flex-col justify-between gap-5">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-white">{surface.title}</h2>
                <ArrowRight className="h-5 w-5 text-white/70" />
              </div>
              <p className="text-sm text-white/70">{surface.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {surface.chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-white/75"
                >
                  {chip}
                </span>
              ))}
            </div>
            <Link
              href={surface.href}
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-secondary transition hover:text-white"
            >
              Enter {surface.title.split(' ')[0]}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </LiquidGlassCard>
        ))}
      </section>
    </main>
  );
}
