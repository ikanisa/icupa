# Agents Policy & Budgeting

The agents service enforces runtime controls before any OpenAI call is executed:

- **Kill switches** – `agent_runtime_configs.enabled` can disable an agent globally or per-tenant.
- **Cost limits** – `agent_runtime_configs.session_budget_usd` and `daily_budget_usd` gate total spend. The helper functions in `apps/agents-service/src/services/telemetry.ts` (`ensureAgentEnabled`, `assertBudgetsAfterRun`) centralise the checks. When the limits are exceeded the request fails fast with a descriptive error.
- **Tool depth** – each agent is configured with `max_tool_depth` to avoid recursive or unbounded tool invocation. This is enforced at orchestration time.
- **Action queue** – stateful actions (inventory changes, promo adjustments) are written to `agent_action_queue`, ensuring a human approves structural updates before they reach production systems.

When adding new agents or tools:

1. Define the tool schemas in `apps/agents-service/src/tools/schemas.ts`.
2. Implement the tool in `apps/agents-service/src/tools/index.ts`, returning structured outputs that match the schema.
3. Call `ensureAgentEnabled` before executing the tool chain, and `assertBudgetsAfterRun` once the model response is available.
4. Log the run via `logAgentEvent` so cost and latency metrics stay consistent.

> _TODO_: add automated unit tests for the policy helpers (budget exhaustion, kill switches) once the Vitest harness is introduced for the agents service.
