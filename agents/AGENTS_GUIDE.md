# Agents Guide Supplement

## Autonomy Preference Runbook

Autonomy levels and composer modes are stored per user/category in `app.user_autonomy_prefs` and surfaced through the
`user-autonomy-save` edge function.

- **Read preferences**: `curl -H "Authorization: Bearer <user-jwt>" "$SUPABASE_URL/functions/v1/user-autonomy-save"`
  returns `{ ok, preferences, source }`.
- **Persist preferences**: POST `{ "preferences": [{ "category": "planner", "level": "L3", "composer": "co_create" }] }`
  to the same endpoint. The function validates categories, clamps to the `L0`–`L5` ladder, and logs via `withObs`.
- **Thresholds**: the orchestrator enforces L2 for read/plan tools and L4 for high-risk side effects (`checkout.intent`,
  `ops.refund`, payouts). Requests below the stored level return `403` with `autonomy` metadata.
- **Fixtures & offline mode**: set `AUTONOMY_PREFS_FIXTURES=1` to fall back to `ops/fixtures/user_autonomy_prefs.json` for
  demos. The client settings sheet highlights fixture loads in the UI.
- **Auditing**: use `select * from app.user_autonomy_prefs where user_id = '<uuid>'` to confirm updates, or inspect
  structured logs tagged `user.autonomy.save_failed` for failures.

Keep these controls in sync with HITL guardrails in `agents/policies/guardrails.md` to ensure the autonomy envelope remains
aligned with ops approval thresholds.
