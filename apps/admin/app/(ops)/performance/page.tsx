import { CardGlass } from "@ecotrips/ui";

const metrics = [
  { scenario: "smoke", p50: 410, p95: 620, p99: 780, errors: 0 },
  { scenario: "checkout-path", p50: 680, p95: 810, p99: 920, errors: 1 },
];

export default function PerformancePage() {
  return (
    <CardGlass title="Performance budgets" subtitle="Perf runner enforces CI gates (p95 ≤ 800ms, errors ≤ 1).">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-300/80">
              <th className="pb-3">Scenario</th>
              <th className="pb-3">p50 (ms)</th>
              <th className="pb-3">p95 (ms)</th>
              <th className="pb-3">p99 (ms)</th>
              <th className="pb-3">Errors</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {metrics.map((row) => (
              <tr key={row.scenario}>
                <td className="py-3">{row.scenario}</td>
                <td className="py-3">{row.p50}</td>
                <td className="py-3">{row.p95}</td>
                <td className="py-3">{row.p99}</td>
                <td className="py-3">{row.errors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardGlass>
  );
}
