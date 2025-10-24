import { CardGlass, Button } from "@ecotrips/ui";

import { LoginForm } from "../components/LoginForm";

const readinessChecks = [
  {
    title: "Realtime availability",
    description: "Sync allotments, blackout dates, and per-room holds directly from your PMS.",
  },
  {
    title: "Impact reporting",
    description: "Publish biodiversity stats and social commitments alongside every confirmed booking.",
  },
  {
    title: "Traveler safety",
    description: "Upload incident playbooks and emergency contacts with SLA tracking for ecoTrips ops.",
  },
];

export default function SupplierLandingPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-16 px-6 py-16 sm:px-10 lg:px-12">
      <section className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-8">
          <p className="inline-flex items-center rounded-full border border-emerald-500/40 px-4 py-1 text-xs uppercase tracking-[0.25em] text-emerald-200/80">
            ecoTrips Supplier Portal
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Keep itineraries confirmed and conservation goals visible.
          </h1>
          <p className="max-w-2xl text-lg text-slate-200/90">
            Review pending traveler requests, confirm service windows, and share sustainability badges in one streamlined workspace.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button variant="glass" asChild>
              <a href="#orders-preview">Preview orders</a>
            </Button>
            <Button variant="secondary" asChild>
              <a href="/orders">Jump to orders</a>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {readinessChecks.map((item) => (
              <CardGlass key={item.title} title={item.title} subtitle={item.description} className="h-full border-white/10 bg-white/5" />
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <LoginForm />
        </div>
      </section>

      <section id="orders-preview" className="space-y-6">
        <CardGlass
          title="Live supplier telemetry"
          subtitle="Fixtures illustrate status badges before wiring real-time inventory feeds."
          className="border-white/10 bg-slate-900/60"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-200/80">Today&rsquo;s arrivals</p>
              <p className="mt-2 text-2xl font-semibold text-white">12 travelers</p>
              <p className="mt-3 text-sm text-slate-200/80">
                Three itineraries require sunrise transport confirmations. Ops SLA: respond in under 15 minutes.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-200/80">Pending documents</p>
              <p className="mt-2 text-2xl font-semibold text-white">4 manifests</p>
              <p className="mt-3 text-sm text-slate-200/80">
                Upload liability waivers and ranger assignments to keep conservation audits current.
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-200/70">
            Supplier admins can add teammates under Settings once the first confirmation is submitted.
          </p>
        </CardGlass>
      </section>
    </div>
  );
}
