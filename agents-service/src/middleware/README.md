# Middleware

This directory will host cross-cutting Fastify middleware (policy enforcement, feature flags, rate limits).

During the refactor we keep existing logic in `services/` but new middleware lives here. Once the migration completes, policy checks (budgets, tool depth, kill switches) should be implemented as composable handlers in this folder.
