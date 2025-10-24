import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Deployment Readiness Report",
  description: "Live evidence tracker for preview builds, rehearsals, and compliance sign-off.",
};

export default function DeploymentReadinessReportPage() {
  return (
    <div className="bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-6 pb-24 pt-16 sm:px-10 lg:px-12">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Release operations</p>
          <h1 className="text-4xl font-semibold text-white sm:text-5xl">Deployment Readiness Report</h1>
          <p className="max-w-3xl text-base text-slate-300">
            Track evidence for router-agent rehearsals, preview builds, and rollback drills. Update the Markdown source in the
            repository to keep this summary current.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Source of Truth</h2>
          <p className="text-slate-200">
            The canonical report lives at <code>DEPLOYMENT_READINESS_REPORT.md</code> in the repository root. Copy console
            evidence into that file during each rehearsal so reviewers can audit the latest state.
          </p>
          <Link
            href="https://github.com/"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
          >
            Open repository (configure project URL)
          </Link>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">What to Record</h2>
          <ul className="list-disc space-y-2 pl-6 text-slate-200">
            <li>Observability probe output (`npm run test:observability`).</li>
            <li>Router-agent rehearsal JSON (`npm run test:rehearsal`).</li>
            <li>Vercel preview build status, including any blocking errors.</li>
            <li>Webpack fallback logs if Turbopack crashes (see `app/scripts/run-next-build.mjs`).</li>
            <li>Rollback drill confirmation via `npm run drill:rollback`.</li>
            <li>ChatKit preview approvals and compliance acknowledgements.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

