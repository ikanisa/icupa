# FinOps Cost Caps & Playbooks

FinOps partners keep ecoTrips spend predictable by enforcing lightweight caps and downgrade playbooks tied to finance telemetry.
The seeded `fin.cost_estimates` table backs the dashboard widget and contains the latest approved thresholds.

## Cost Caps

| Category | Monthly Cap | Notes |
| --- | --- | --- |
| LLM tokens | $12,850 | Includes concierge itinerary generation and ops copilots. Trigger soft alert at 85% utilization. |
| Storage | $6,850 | Covers `invoices/` and `supplier_media/` buckets with 45-day retention. Expansion requires finance review. |
| Network egress | $4,720 | Primarily Supabase → Vercel API responses plus nightly analytics exports. |

## Downgrade Playbooks

- **LLM tokens**
  1. Shift concierge drafts to cached itineraries and require HITL approval for new runs.
  2. Flip the `AI_CONCIERGE_AUTO_APPROVE` flag to `false` via ops console settings.
  3. Notify suppliers about slower SLA using the pre-approved "traffic shaping" template.
- **Storage**
  1. Enable Glacier lifecycle for assets older than 21 days in `supplier_media/`.
  2. Rotate invoice HTML exports to 30-day retention and archive PDFs to cold storage.
  3. Run `ops:sanitization trim-media --dry-run` and escalate diffs ≥ 200 GB.
- **Network egress**
  1. Pause nightly analytics exports and replace with weekly batched CSVs.
  2. Route concierge reads through the edge cache feature flag to absorb traffic.
  3. Engage platform to review Supabase row-level caching metrics before re-enabling.

## Review Cadence

- **Weekly (Monday)**: Finance + ops sync reviews the latest `fin.cost_estimates` entries and compares to rolling 4-week averages.
- **Monthly (First business day)**: CFO review of cap vs. actual, update downgrade playbooks, and confirm instrumentation coverage.
- **Quarterly**: Postmortem on any breach events and refresh budget guardrails before seasonal demand spikes.

## Seed Snapshot

Reference export from the migration fixtures:

```
select to_char(month, 'YYYY-MM') as month,
       category,
       estimated_cents / 100 as usd,
       confidence,
       usage_notes
from fin.cost_estimates
order by estimated_cents desc;

 month   |  category   |   usd   | confidence |                           usage_notes
---------+-------------+---------+------------+-----------------------------------------------------------------
 2025-02 | llm_tokens  | 12850.0 | medium     | 52M input/output tokens across concierge and ops pilot batches.
 2025-02 | storage     |  6850.0 | high       | 9.1 TB stored across invoices/, supplier_media/ with 45 day retention.
 2025-02 | egress      |  4720.0 | medium     | High read volume from concierge itineraries + nightly analytics exports.
```

Keep this snapshot aligned with Supabase after every fixture update so acceptance checks remain green.
