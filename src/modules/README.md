# Feature Modules (in progress)

This directory will gradually host feature-scoped modules that group components, hooks, and utilities by domain.

During the refactor we are introducing additive re-export barrels so that existing imports continue to work while new code can target a stable module boundary.

Current modules:

- `diner` – diner/table experience primitives (menu grid, cart, AI waiter hooks)
- `merchant` – merchant portal surfaces (onboarding, menu ingestion helpers)
- `admin` – admin console helpers
- `agents-ui` – reusable AI chat/voice components
- `common` – shared UI + utility exports used across surfaces

> As the cleanup progresses, components from `src/components` and hooks from `src/hooks` will migrate into these modules. Until then, the barrels simply re-export existing locations.
