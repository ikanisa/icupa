import type { Metadata } from "next";
import Link from "next/link";
import { PhaseTaskBoard } from "../components/PhaseTaskBoard";

export const metadata: Metadata = {
  title: "Integration Phases | ecoTrips Ops",
  description:
    "Interactive integration checklist with clipboard-ready commands for reconnecting remotes, merging branches, and validating Vercel deployments.",
};

export default function PhasesPage() {
  return (
    <div className="bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-16 px-6 pb-24 pt-16 sm:px-10 lg:px-12">
        <header className="space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 transition hover:text-emerald-200"
          >
            ← Back to marketing site
          </Link>
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Release operations</p>
          <h1 className="text-4xl font-semibold text-white sm:text-5xl">Integration phase control tower</h1>
          <p className="max-w-3xl text-base text-slate-300">
            Move through the integration lifecycle with grouped, clipboard-ready checklists. Each start button captures the
            commands you need and tracks progress inline so the release team can swarm efficiently.
          </p>
        </header>

        <PhaseTaskBoard />
      </main>
    </div>
  );
}
