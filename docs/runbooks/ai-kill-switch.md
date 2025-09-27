# AI Kill Switch Runbook

This runbook details the response steps when AI agents must be suspended immediately—either due to safety violations (e.g., allergen miss, age gate breach), regulatory request, or major platform degradation.

## Triggers

- Safety monitoring or human QA detects an allergen/age-gate violation attributed to an agent response.
- Regulatory/compliance directs a halt of autonomous or semi-autonomous behaviour.
- Agents service degraded (latency > 5s p95 or error rate > 5%) causing diner delays.

## Preparation checklist

- Ensure the `agent_runtime_configs` table contains per-agent `enabled` flags and autonomy levels for L0–L3 control.
- Maintain feature flags for agent entry points in the diner, merchant, and admin UIs (e.g., `waiter_agent_enabled`, `upsell_agent_enabled`).
- Document the service-role API keys for Supabase and the Agents service in the secure secrets manager.

## Immediate response

1. **Acknowledge**
   - Page the AI on-call engineer and the compliance officer.
   - Announce the incident in the incident channel with reason, scope, and requested action.
2. **Disable agents centrally**
   - Update `agent_runtime_configs.enabled = false` for affected agents using the admin console or a direct Supabase query.
   - Trigger the agents service `/admin/refresh-config` (if available) or restart the deployment to pick up the disabled state.
   - Toggle frontend feature flags to hide or grey out AI entry points (chat dock, upsell tiles) and surface “Temporarily unavailable” messaging.
3. **Confirm guardrail activation**
   - Ensure the diner shell falls back to human assistance prompts and no longer queues agent requests.
   - Verify merchant/admin portals remove AI suggestions or label them as offline.

## Additional containment

- **Data capture**: Snapshot offending conversations, tool traces (`agent_events`), and telemetry for post-incident review.
- **Notify stakeholders**: Inform merchant success, support, and regulatory contacts that AI features are paused.
- **Public messaging**: Update status page and in-app notifications if the outage is tenant-wide.

## Recovery steps

1. **Root cause analysis**
   - Reproduce the issue in staging using the captured context.
   - Patch prompts, guardrails, tool policies, or data sources as required.
   - Execute evaluation suites (golden Q&A, allergen regression, hallucination audits) to validate the fix.
2. **Gradual re-enable**
   - Re-enable agents in staging, monitor metrics, then canary with 10% of tenants before full rollout.
   - Remove temporary UI banners once confidence is restored.
3. **Incident retrospective**
   - Document timeline, contributing factors, remediation, and follow-up actions.
   - Update runbooks, prompts, or tooling based on learnings.

## Preventative measures

- Automate guardrail evals (allergen, age-gate, hallucination) in CI with promotion gates.
- Maintain kill-switch drills quarterly to ensure toggles, scripts, and comms remain functional.
- Regularly review agent telemetry for drift, spending spikes, or unusual tool usage patterns.
