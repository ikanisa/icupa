import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Router-Agent Activation Release Notes",
  description:
    "Release summary, deployment checklist, and stakeholder communications for the router-agent activation and compliance safeguards.",
};

export default function RouterAgentActivationPage() {
  return (
    <div className="bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-10 px-6 pb-24 pt-16 sm:px-10 lg:px-12">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Release operations</p>
          <h1 className="text-4xl font-semibold text-white sm:text-5xl">Router-Agent Activation</h1>
          <p className="max-w-3xl text-base text-slate-300">
            Use this briefing to coordinate router-agent smoke tests, ChatKit preview reviews, and compliance approvals ahead of
            launch.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Summary</h2>
          <ul className="list-disc space-y-2 pl-6 text-slate-200">
            <li>
              Router-agent smoke coverage now combines observability probes with the rehearsal suite to confirm WhatsApp pricing,
              voice fallback, and GDPR logging behaviour.
            </li>
            <li>
              ChatKit preview assets document the concierge prompts and guardrails so product, design, and support can review the
              activation experience asynchronously.
            </li>
            <li>
              Compliance safeguards highlight GDPR, privacy export, and audit logging checkpoints backed by Supabase telemetry and
              agent audit trails.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Deployment Checklist</h2>
          <ol className="list-decimal space-y-2 pl-6 text-slate-200">
            <li>
              Execute <code>npm run test:observability</code> and <code>npm run test:rehearsal</code>; paste console evidence into
              <code>DEPLOYMENT_READINESS_REPORT.md</code>.
            </li>
            <li>Upload ChatKit preview screenshots or shareable links with annotation, owners, and approval dates.</li>
            <li>Run <code>npm run drill:rollback</code> and archive the output with the incident response template.</li>
            <li>
              Capture compliance review notes and link supporting artefacts such as <code>ops/privacy/DATAMAP.md</code> and
              <code>agents/observability.md</code>.
            </li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Stakeholder Communications</h2>
          <ul className="list-disc space-y-2 pl-6 text-slate-200">
            <li>
              <strong>Ops &amp; Support:</strong> Share rehearsal outcomes plus rollback confirmation in the launch channel, noting
              any degraded WhatsApp coverage or pending credential work.
            </li>
            <li>
              <strong>Product &amp; Design:</strong> Circulate ChatKit preview links outlining router-agent routing, entry points, and
              fallback messaging; capture approvals in the design tracker.
            </li>
            <li>
              <strong>Compliance &amp; Legal:</strong> Provide GDPR logging evidence and confirm retention windows meet policy; log any
              exceptions with remediation timelines.
            </li>
            <li>
              <strong>Engineering Leadership:</strong> Summarise overall readiness plus the go/no-go window and rollback command
              sequence.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Evidence Log</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[24rem] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-900/70 text-emerald-200">
                  <th className="border border-slate-700 px-3 py-2 text-left">Date</th>
                  <th className="border border-slate-700 px-3 py-2 text-left">Artifact</th>
                  <th className="border border-slate-700 px-3 py-2 text-left">Owner</th>
                  <th className="border border-slate-700 px-3 py-2 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-800 px-3 py-2 text-slate-300">TBD</td>
                  <td className="border border-slate-800 px-3 py-2 text-slate-300">ChatKit preview link</td>
                  <td className="border border-slate-800 px-3 py-2 text-slate-300">TBD</td>
                  <td className="border border-slate-800 px-3 py-2 text-slate-300">Add reviewer comments</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

