# ecoTrips Perf Runner

The perf runner exercises critical Supabase Edge Functions against perf budgets (`p95 ≤ 800ms`, `errors ≤ 1`).

## Usage

```bash
deno run -A ops/perf/perf_runner.ts --scenario smoke
```

Scenarios are defined in `scenarios.json`. Each step issues a fetch with anon credentials, logging durations and enforcing
budgets. Extend the runner with additional scenarios as new surfaces launch.
