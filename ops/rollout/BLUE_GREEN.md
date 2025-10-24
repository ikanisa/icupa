# Flag-Driven Blue/Green & Canary Rollouts

EcoTrips' production rollouts lean on feature flags to steer traffic between blue/green stacks or to stage gradual canaries. Flags let us flip cohorts without redeploying, and they provide a single control plane whether traffic is sourced from Supabase config, environment variables, or JSON fixtures during rehearsals.

## Flag contract and storage

Flags are stored in Supabase (`ops.console_feature_flags`) for live operations and mirrored in configuration fixtures for drills. Every flag payload should be JSON-serializable, include operator notes, and use percentage-based keys for gradual rollouts. The client libraries default to the values exported from `@ecotrips/config/feature-flags` when Supabase is unavailable.

```json
{
  "planner_v2_enabled_pct": 45,
  "notes": "Route 45% of traffic to Planner v2 surfaces. Remaining users stay on ConciergeGuide-first UI.",
  "last_reviewed_at": "2025-05-06T12:00:00Z"
}
```

### Recommended source of truth

1. **Primary** – Supabase `ops.console_feature_flags` table synchronized via migrations.
2. **Secondary** – Git-tracked fixtures (see `ops/fixtures`) for disaster-recovery drills.
3. **Tertiary** – Runtime overrides injected via the config package for local development or previews.

## Blue/Green procedure with flags

1. **Prep both stacks** – Deploy the "green" stack in parallel while "blue" serves traffic. Ensure both read from the same flag store.
2. **Prime fixtures** – Update the shared JSON payload (example above) so both stacks evaluate identical thresholds.
3. **Warm green traffic** – Point synthetic or internal traffic at the green stack while `planner_v2_enabled_pct` remains low (e.g., 5%).
4. **Flip external cohorts** – Increase `planner_v2_enabled_pct` for targeted cohorts (staff, beta users) via Supabase. Monitor telemetry.
5. **Full cutover** – Once error budgets hold, raise the flag to 100%, switch routing to the green stack, and retire blue.
6. **Rollback** – Drop the percentage back to 0% (or restore the previous JSON snapshot) to immediately return to the blue experience without redeploying.

## Canary rollout procedure

1. **Define cohorts** – Decide on cohort buckets (e.g., `Math.random()` or hashed user IDs) used by the feature gate client.
2. **Stage config** – Commit a JSON config with the desired starting percentage (e.g., 5%) and publish to Supabase.
3. **Observe** – Use withObs dashboards to verify Planner v2 error rates, latency, and conversion.
4. **Incrementally increase** – Raise `planner_v2_enabled_pct` in 5–10% increments, pausing if alerts fire.
5. **Document** – Log percentage changes in Ops channel and append notes to the flag payload for auditability.
6. **Finalize** – When the canary stabilizes, bump to 100% and remove any feature-specific fallbacks at the next sprint review.

## Observability & rollback triggers

- **withObs dashboards** for Planner v2 success/error rates and latency percentiles.
- **Supabase audit** on `ops.console_feature_flags` captures who changed percentages.
- **Client telemetry** (`PlannerFeatureGate` debug logs) prints evaluated buckets during non-production builds.
- **Rollback criteria** include >2% tool error, >5% quote SLA breach, or concierge escalations exceeding the weekly baseline.

## Console evaluation example

Evaluate rollout decisions locally to confirm thresholds before editing Supabase rows:

```bash
$ node --input-type=module -e "import('./packages/config/feature-flags.js').then(({ shouldEnablePlannerV2 }) => { console.log(shouldEnablePlannerV2({ bucket: 0.27 })); });"
{ enabled: true, threshold: 45, bucket: 0.27 }
```

The command imports the shared config helper and evaluates a deterministic bucket (`0.27`), demonstrating that a 45% rollout would serve Planner v2 to that request.

## Sample multi-stage JSON payloads

```json
// canary.json
{
  "planner_v2_enabled_pct": 10,
  "notes": "Beta cohort only — watch quote latency.",
  "segments": ["staff", "beta_waitlist"]
}
```

```json
// blue_green_cutover.json
{
  "planner_v2_enabled_pct": 100,
  "notes": "Full cutover to green stack after verifying SLOs for 4h.",
  "rollback_playbook": "Decrease to 0% and re-enable ConciergeGuide-first templates."
}
```

Keep these payloads alongside runbooks so operators can rehearse flipping between them with confidence.
