import Link from "next/link";
import { CardGlass, Button } from "@ecotrips/ui";

const histogramBuckets = [
  { label: "00-02", total: 2 },
  { label: "02-04", total: 3 },
  { label: "04-06", total: 6 },
  { label: "06-08", total: 9 },
  { label: "08-10", total: 12 },
  { label: "10-12", total: 7 },
  { label: "12-14", total: 4 },
  { label: "14-16", total: 3 },
  { label: "16-18", total: 5 },
  { label: "18-20", total: 8 },
  { label: "20-22", total: 6 },
  { label: "22-24", total: 2 },
] as const;

const incidentFixtures = [
  {
    id: "INC-4312",
    failureCode: "stripe_unavailable",
    count: 7,
    recommended: "Cool-off + retry",
    requestId: "req_61f3",
  },
  {
    id: "INC-4311",
    failureCode: "card_declined",
    count: 5,
    recommended: "Send issuer checklist",
    requestId: "req_61b8",
  },
  {
    id: "INC-4308",
    failureCode: "momo_timeout",
    count: 3,
    recommended: "Fallback to PAYMENT_MOCK",
    requestId: "req_61a1",
  },
] as const;

const failureCopy: Record<string, { title: string; body: string; hint: string }> = {
  stripe_unavailable: {
    title: "Stripe API degradation",
    body: "Provider returned 5xx/429 responses. Payment escalation recommends spacing retries and notifying finance ops.",
    hint: "Trigger payment-escalate for rate-limit aware retries.",
  },
  card_declined: {
    title: "Card declined",
    body: "Travelers must call issuers to unlock the charge. Provide checklist + alternate payment link.",
    hint: "Use payment-escalate copy_text CTA to share traveler guidance.",
  },
  momo_timeout: {
    title: "MoMo timeout",
    body: "MTN Mobile Money reported timeout. Switch to PAYMENT_MOCK ledger capture if retries fail.",
    hint: "Queue offline capture and ping #finops-alerts.",
  },
};

function Histogram() {
  const maxValue = Math.max(...histogramBuckets.map((bucket) => bucket.total));
  return (
    <div className="flex items-end gap-1">
      {histogramBuckets.map((bucket) => (
        <div key={bucket.label} className="flex w-full flex-col items-center gap-1">
          <div
            className="w-full rounded-t-lg bg-gradient-to-t from-sky-500/70 via-sky-400/80 to-sky-200/90"
            style={{ height: `${Math.max(4, (bucket.total / maxValue) * 120)}px` }}
          />
          <span className="text-[10px] uppercase tracking-wider text-white/50">{bucket.label}</span>
          <span className="text-xs font-semibold text-white/70">{bucket.total}</span>
        </div>
      ))}
    </div>
  );
}

export default function FinanceIncidentsBoard() {
  return (
    <div className="space-y-6">
      <CardGlass
        title="Payment incidents"
        subtitle="Fixture histogram summarises failed intents over the last 24h."
      >
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2 text-sm text-white/80">
                <p className="text-xs uppercase tracking-[0.28em] text-white/40">Escalation coverage</p>
                <h2 className="text-2xl font-semibold text-white">24h histogram</h2>
                <p>
                  Buckets refresh whenever payment-escalate receives a new failure code. Use it to size staffing and see whether
                  idempotent retries mitigate the incident.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Link href="/finance" className="text-xs text-sky-200 underline">Back to Finance</Link>
                  <Link href="/finance/incidents?view=raw" className="text-xs text-white/60 underline">
                    Export raw fixtures
                  </Link>
                </div>
              </div>
              <div className="w-full max-w-xl">
                <Histogram />
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {incidentFixtures.map((incident) => {
              const copy = failureCopy[incident.failureCode] ?? {
                title: incident.failureCode,
                body: "Review escalation guidance for recommended runbooks.",
                hint: "",
              };
              return (
                <div key={incident.id} className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/50">{incident.id}</p>
                      <h3 className="text-lg font-semibold text-white">{copy.title}</h3>
                    </div>
                    <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200">
                      {incident.count} hits
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-white/70">{copy.body}</p>
                  <p className="mt-3 text-xs uppercase tracking-wide text-white/40">
                    Recommended: {incident.recommended}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="glass" asChild>
                      <Link href={`/finance/incidents/${incident.id.toLowerCase()}`} prefetch={false}>
                        View incident detail
                      </Link>
                    </Button>
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/finance/incidents/replay?requestId=${incident.requestId}`} prefetch={false}>
                        Replay in sandbox
                      </Link>
                    </Button>
                  </div>
                  {copy.hint && <p className="mt-3 text-[11px] uppercase tracking-wide text-white/40">{copy.hint}</p>}
                </div>
              );
            })}
            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 text-sm text-white/70">
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">Upcoming</p>
              <h3 className="mt-2 text-lg font-semibold text-white">Ops automation</h3>
              <p className="mt-2">
                Align this board with ops-exceptions: escalate to human-on-duty when payment-escalate surfaces repeated failures.
                The histogram drives staffing, while the runbook CTAs link directly to new edge functions.
              </p>
              <Button className="mt-4" variant="glass" asChild>
                <Link href="/finance/incidents?subscribe=1">Subscribe to incident digest</Link>
              </Button>
            </div>
          </div>
        </div>
      </CardGlass>
    </div>
  );
}
