import Link from "next/link";
import OpsProtected from "./OpsProtected";
import { OpsNav } from "../../components/OpsNav";

export default function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OpsProtected>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <header className="border-b border-slate-800/70 bg-slate-950/80">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">ecoTrips operator console</p>
              <h1 className="text-2xl font-semibold text-white">Keep travelers on schedule</h1>
              <p className="text-sm text-slate-400">Monitor manifests, unblock refunds, and watch supplier SLAs in one place.</p>
            </div>
            <Link
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
              href="/"
            >
              ← Back to marketing site
            </Link>
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 lg:flex-row">
          <aside className="w-full max-w-xs space-y-6 rounded-3xl border border-slate-800 bg-slate-900/50 p-5 lg:sticky lg:top-10 lg:h-fit">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-white">Queues</h2>
              <p className="text-xs text-slate-400">Switch between operational workstreams.</p>
            </div>
            <OpsNav />
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/70 p-4 text-xs text-slate-400">
              <p className="font-semibold text-emerald-200">Deployment health</p>
              <p>Live data only. Fixture toggles will raise deployment alerts automatically.</p>
            </div>
          </aside>
          <main className="flex-1 space-y-6">
            {children}
          </main>
        </div>
      </div>
    </OpsProtected>
  );
}
