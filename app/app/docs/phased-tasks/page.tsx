import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadRunbook() {
  const filePath = join(process.cwd(), "docs", "PHASED_TASKS.md");
  return readFileSync(filePath, "utf8");
}

export const metadata: Metadata = {
  title: "Phased Tasks Runbook | ecoTrips Ops",
  description:
    "Reference copy of the phased integration runbook with task stubs, suggested actions, and conflict-resolution checklists.",
};

export default function PhasedTasksDocPage() {
  const markdown = loadRunbook();

  return (
    <div className="bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 pb-24 pt-16 sm:px-10 lg:px-12">
        <header className="space-y-3">
          <Link
            href="/phases"
            className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 transition hover:text-emerald-200"
          >
            ← Back to interactive board
          </Link>
          <h1 className="text-4xl font-semibold text-white sm:text-5xl">Phased integration runbook</h1>
          <p className="max-w-3xl text-base text-slate-300">
            This page renders the Markdown source tracked in <code>docs/PHASED_TASKS.md</code> so reviewers can cross-reference the
            live task board with the canonical written process.
          </p>
        </header>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
          <pre className="overflow-x-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
            <code>{markdown}</code>
          </pre>
        </section>
      </main>
    </div>
  );
}
