# Incident Response Playbook

## 1. Triage
1. Acknowledge the alert in the primary channel (PagerDuty / Slack `#eco-ops`).
2. Assign an Incident Commander (IC). If no senior engineer is online, the first responder becomes interim IC until relieved.
3. Capture the initial context in the incident doc:
   - Timestamp
   - Alert source and message
   - Services or user journeys affected
   - Current severity level

## 2. Stabilise
1. Activate feature toggles if available (`USE_FIXTURES=1`, `OPS_REFUND_MODE=mock`, `WA_OFFLINE=1`) to reduce blast radius.
2. For payment issues, pause the checkout entry point via configuration (set `STRIPE_MOCK_MODE=1`) while root cause is investigated.
3. Use the health endpoints and synthetics probe to scope the outage:
   ```sh
   curl -s "$SUPABASE_URL/functions/v1/synthetics-probe" \
     -H "apikey: $SUPABASE_SERVICE_ROLE" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE"
   ```
4. Document every mitigation attempt and its outcome in the incident doc.

## 3. Communication
- External status updates follow the cadence: **T0** (acknowledgement), **+30m**, **hourly** until resolved, unless SLAs specify otherwise.
- Keep customer support informed via the shared `#eco-support` channel; provide a plain-language summary and workaround if available.
- If data exposure is suspected, escalate to the Privacy officer immediately.

## 4. Resolution & Verification
1. Roll out the fix (blue/green steps in `scripts/deploy/blue_green.sh`).
2. Run the contract and observability smoke suites:
   ```sh
   npm run test:contracts
   npm run test:observability
   ```
3. Disable any temporary toggles (`USE_FIXTURES=0`, `STRIPE_MOCK_MODE=0`, etc.).
4. Confirm SLO recovery via dashboards and close the incident in the tracking system.

## 5. Postmortem
- Schedule the post-incident review within 48 hours.
- Collect logs, timelines, and any metrics snapshots.
- Identify contributing factors, what worked well, and the backlog of follow-up actions.

## Escalation Contacts
| Role | Primary | Secondary |
| ---- | ------- | --------- |
| Engineering Lead | @eng-lead | @eng-backup |
| Payments SME | @payments-oncall | @finance-ops |
| Privacy/Data | @privacy-lead | @dpo |
| Support | @support-lead | @support-backup |

Update this table whenever on-call rotations change.

## Rollback Reference
- Keep the annotated `rollback_playbook` JSON from `ops/rollout/BLUE_GREEN.md` available during incidents to revert router-agent traffic quickly.
- Document the exact `npm run drill:rollback` command output in the incident timeline before restoring normal routing.
