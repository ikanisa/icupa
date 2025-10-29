# Copilot Instructions for ICUPA

## Repository Overview

ICUPA is a **multi-tenant PWA** for in-venue ordering (Rwanda/Malta). **pnpm workspace monorepo** using Vite + React 18, TypeScript, Tailwind, Supabase.

**Stack:** React 18.3, TypeScript 5.8, Vite 5.4, Tailwind 3.4, Supabase 2.x, TanStack Query, Radix UI  
**Node:** 18.18.2 (.nvmrc) | **Package Manager:** `pnpm` (NOT npm) | **Deps:** ~1300 packages

## Structure

```
├── .github/workflows/        # CI: ci.yml (lint/type/build), playwright.yml, supabase-deploy.yml
├── apps/                     # Multiple apps: admin, client, web (Vite SPA), ecotrips (nested)
├── agents-service/           # Fastify OpenAI agents (port 8787)
├── packages/                 # Shared: config, db, ui, types, ingestion-utils
├── src/                      # Main Vite app: components/, integrations/supabase/, hooks/, pages/
├── supabase/                 # migrations/, seed/, tests/, functions/ (Edge Functions)
├── scripts/                  # ci/, dev/, ops/, supabase/ (deploy/health scripts)
├── tests/                    # playwright/, k6/, accessibility/
├── eslint.config.js          # Flat ESLint v9
├── vite.config.ts            # Vite + Vitest
└── package.json              # Workspace scripts
```

## Build & Test Commands

**⚠️ Use `pnpm` NOT `npm`**

### Essential Sequence
```bash
pnpm install              # Install deps (required first)
pnpm lint                 # ESLint --max-warnings=0
pnpm typecheck            # TypeScript check
pnpm test                 # Vitest unit tests
pnpm build                # Production build
```

### Environment
- **Required for builds** (in shell, not .env.local):
  ```bash
  VITE_SUPABASE_URL=https://test.supabase.co VITE_SUPABASE_ANON_KEY=test pnpm build
  ```
- Copy `.env.example` → `.env.local` for dev (real values)

### Supabase Local
```bash
supabase start                        # Docker required
supabase db reset --local --yes      # Apply migrations
supabase seed --local --yes          # Load demo data
pnpm supabase:test                   # SQL tests
```
**Note:** Supabase CLI may not install via pnpm. Use: `npm i -g supabase` or `npx supabase`

### Dev Servers
```bash
pnpm dev                 # Vite (port 8080)
pnpm dev:all             # All services (web + agents + ocr)
pnpm dev:agents          # Agents only (port 8787)
```

### Verification
```bash
pnpm verify              # lint + typecheck + test
pnpm verify:full         # + E2E + SQL tests
pnpm test:e2e            # Playwright (needs browsers)
```

## Known Issues & Workarounds

1. **Pre-existing lint errors** - Repository has parsing errors in apps/ecotrips. Ignore unless modifying those files.
2. **Test failures** - 2 tests fail in `supabase/functions/_shared/headers.test.ts` (snapshot mismatches). Pre-existing, safe to ignore.
3. **Supabase CLI** - May not install via pnpm. Use `npm i -g supabase` or `npx supabase`.
4. **Node version** - .nvmrc=18.18.2 but Node 20.x works (warnings OK).
5. **Pretest hook** - `reset-supabase-test-db.mjs` skips if no Supabase CLI/Docker. Tests auto-skip DB-dependent cases.

## Code Standards

**ESLint:** `eslint.config.js` (flat v9) | Run: `pnpm lint` (--max-warnings=0) | Fix: `pnpm lint:fix`  
**Prettier:** `prettier.config.mjs` (semi, double quotes, 100 width) | Run: `pnpm format`  
**TypeScript:** `tsconfig.base.json` (strict: false) | Run: `pnpm typecheck`

## CI/CD

**`.github/workflows/ci.yml`** (on push to main + PRs):
1. Node 18.18.2 + pnpm 10
2. `pnpm install`
3. `pnpm lint`
4. `pnpm typecheck`
5. `pnpm build`

**⚠️ Tests NOT run in CI** - Only lint/typecheck/build

## Common Patterns

### Dependencies
```bash
pnpm add <package>                           # Root workspace
pnpm --filter agents-service add <package>   # Specific workspace
```

### Supabase
- **Migrations:** Add timestamped file in `supabase/migrations/`
- **Edge Functions:** `supabase/functions/` → deploy via `scripts/supabase/deploy-functions.sh`
- **Types:** `supabase gen types typescript --schema public > src/integrations/supabase/types.ts`

### Components
- Radix UI (`@radix-ui/react-*`), Tailwind, Lucide icons, react-hook-form + zod

## Testing

**Unit (Vitest):** Co-located `.test.ts/.tsx` or `tests/` | Config: `vite.config.ts` + `vitest.setup.ts`  
**E2E (Playwright):** `tests/playwright/specs/` | Config: `tests/playwright/playwright.config.ts`  
**SQL:** `supabase/tests/*.sql` | Run: `pnpm supabase:test`

## Key Files

- `package.json` - Scripts, deps
- `pnpm-workspace.yaml` - Workspaces
- `vite.config.ts` - Vite + Vitest + aliases
- `eslint.config.js` - Lint rules
- `tsconfig.base.json` - TS aliases
- `supabase/config.toml` - Supabase config
- `scripts/ci/check-supabase-env.mjs` - Validates env before build
- `scripts/ci/reset-supabase-test-db.mjs` - Resets test DB (pretest hook)

## Agent Guidance

1. **Trust these instructions.** Only search if incomplete/incorrect.
2. **Always use `pnpm`**, never `npm`.
3. **Run `pnpm lint && pnpm typecheck`** before/after changes.
4. **Ignore pre-existing failures** (lint errors in ecotrips/, 2 header tests).
5. **Make minimal changes.** Don't refactor unrelated code.
6. **Env vars required for builds.** Use shell env or dummy values.
7. **Supabase needs Docker.** Tests skip DB tests gracefully if unavailable.
8. **Multiple workspaces.** Most work in `src/`, `apps/web/`, `packages/`.
9. **CI = lint/typecheck/build only.** Ensure `pnpm lint && pnpm typecheck && pnpm build` pass.
10. **When in doubt:** `pnpm verify` (lint + typecheck + test).
