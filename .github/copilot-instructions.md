# Copilot Instructions for ICUPA

## Repository Overview

ICUPA is a **multi-tenant Progressive Web Application (PWA)** for in-venue ordering across Rwanda and Malta. It's a **pnpm workspace monorepo** using Vite + React 18, TypeScript, Tailwind CSS, and Supabase. The project includes three surfaces: diner (client), merchant, and admin portals, with an AI agents service for OpenAI-powered interactions.

**Size:** ~1300 dependencies, multiple apps/packages workspaces  
**Primary Stack:** React 18.3, TypeScript 5.8, Vite 5.4, Tailwind 3.4, Supabase 2.x, TanStack Query, Radix UI, Framer Motion  
**Node Version:** 18.18.2 (from .nvmrc, though Node 20.x is tolerated with warnings)  
**Package Manager:** pnpm 10.x (use `pnpm` commands, NOT `npm`)

## Project Structure

```
├── .github/workflows/        # CI/CD: ci.yml, playwright.yml, supabase-deploy.yml
├── apps/
│   ├── admin/               # Admin console Next.js app
│   ├── client/              # Diner/client Next.js app
│   ├── ecotrips/            # Nested multi-app structure (ignore for ICUPA work)
│   ├── ocr-converter/       # Local dev OCR service (Node.js)
│   ├── vendor/              # Vendor portal
│   └── web/                 # Main Vite SPA
├── agents-service/          # Fastify service for OpenAI agents (port 8787)
├── packages/
│   ├── config/              # Shared ESLint/Tailwind configs
│   ├── db/                  # Supabase client utilities
│   ├── ingestion-utils/     # Menu ingestion helpers
│   ├── types/               # Shared TypeScript types
│   └── ui/                  # Shared React components
├── src/                     # Main Vite app source
│   ├── components/          # UI components (client/merchant/admin shells)
│   ├── integrations/supabase/ # Supabase client + types
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utilities (currency, motion, etc.)
│   └── pages/               # Route components
├── supabase/
│   ├── migrations/          # SQL migrations (20+ files, phase-based)
│   ├── seed/                # Demo data (seed.sql)
│   ├── tests/               # SQL test suite (12 files)
│   └── functions/           # Edge Functions (payments, admin, menu, etc.)
├── scripts/
│   ├── ci/                  # CI helpers (reset-supabase-test-db.mjs, check-supabase-env.mjs)
│   ├── dev/                 # Dev scripts (dev-all.sh runs all services)
│   ├── ops/                 # Operations scripts (health-check.sh)
│   └── supabase/            # Supabase deploy/secrets scripts
├── tests/
│   ├── playwright/          # E2E tests (specs/ and config)
│   ├── k6/                  # Load tests
│   └── accessibility/       # axe-core WCAG tests
├── eslint.config.js         # Flat ESLint config (v9)
├── vite.config.ts           # Vite config with vitest
├── tsconfig.*.json          # TypeScript configs (base, app, node)
└── package.json             # Workspace scripts
```

## Critical Build & Test Commands

**⚠️ ALWAYS use `pnpm` commands (NOT `npm`). The project uses pnpm workspaces.**

### Essential Pre-flight Sequence

```bash
# 1. Install dependencies (required first)
pnpm install

# 2. Lint (runs ESLint with --max-warnings=0)
pnpm lint

# 3. Type-check (runs tsc -b)
pnpm typecheck

# 4. Run unit tests (Vitest)
pnpm test

# 5. Build production bundle
pnpm build
```

### Environment Setup

- **Required env vars for builds** (must be in shell environment, not just .env.local):
  - `VITE_SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`)
  - `VITE_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- Build will fail fast if these are missing (enforced by `prebuild` script)
- **For testing builds only**, use dummy values:
  ```bash
  VITE_SUPABASE_URL=https://test.supabase.co VITE_SUPABASE_ANON_KEY=test-key pnpm build
  ```
- Copy `.env.example` → `.env.local` and fill in real values for local development

### Supabase Local Development

```bash
# Start local Supabase (requires Docker and Supabase CLI)
supabase start

# Reset database with migrations + seed data
supabase db reset --local --yes
supabase seed --local --yes

# Run SQL test suite
supabase db test
# OR use workspace script:
pnpm supabase:test
```

**⚠️ Supabase CLI Warning:** The local `supabase` binary may fail to install via pnpm. If `supabase` command is not found, use:
```bash
# Install globally or use npx
npm install -g supabase
# OR use npx for one-off commands
npx supabase db reset --local --yes
```

### Development Servers

```bash
# Main Vite dev server (port 8080, NOT 5173)
pnpm dev

# Start all services together (web + agents + ocr-converter)
pnpm dev:all
# OR manually:
pnpm dev:agents          # Fastify agents service (port 8787)
pnpm dev:ocr:converter   # OCR converter shim (port 8789)
```

### Full Verification

```bash
# Quick verify (lint + typecheck + unit tests)
pnpm verify

# Full verify (includes E2E + SQL tests)
pnpm verify:full
```

### E2E Tests

```bash
# Playwright tests (requires browsers installed)
pnpm test:e2e
# Browsers auto-install via: npx playwright install --with-deps

# Accessibility tests
pnpm test:accessibility
```

## Known Issues & Workarounds

### 1. Lint Errors in Repository

**Issue:** Repository has pre-existing lint errors (parsing errors, react-hooks warnings).  
**Workaround:** Focus ONLY on files you modify. Ignore unrelated lint errors. Run `pnpm lint` before and after your changes to see diff.

### 2. Test Failures

**Issue:** 2 tests in `supabase/functions/_shared/headers.test.ts` currently fail (snapshot mismatches).  
**Workaround:** These are pre-existing failures. Ignore them unless you're modifying that file.

### 3. Supabase CLI Installation

**Issue:** `pnpm install` may fail to create `supabase` binary in `node_modules/.bin/`.  
**Workaround:** Install globally: `npm install -g supabase` or use `npx supabase`.

### 4. Node Version Mismatch

**Issue:** `.nvmrc` specifies 18.18.2, but Node 20.x works with warnings.  
**Workaround:** Warnings are safe to ignore. Both versions work.

### 5. Pretest Database Reset

**Issue:** `pretest` script runs `reset-supabase-test-db.mjs` which warns if Supabase CLI is unavailable.  
**Workaround:** Tests will skip database-dependent tests automatically. For full test coverage, ensure Supabase CLI is available and Docker is running.

## Code Style & Standards

### ESLint

- **Config:** `eslint.config.js` (flat config, ESLint v9)
- **Run:** `pnpm lint` (fails on any warnings: `--max-warnings=0`)
- **Auto-fix:** `pnpm lint:fix`
- **Note:** Many warnings exist for `react-refresh/only-export-components`. These are informational in Next.js app routes.

### Prettier

- **Config:** `prettier.config.mjs`
- **Settings:** semi, double quotes, trailing commas, 100 char width, 2 spaces
- **Run:** `pnpm format` (writes) or `pnpm format:check`

### TypeScript

- **Configs:** `tsconfig.base.json` (shared), `tsconfig.app.json`, `tsconfig.node.json`
- **Run:** `pnpm typecheck`
- **Note:** `strict: false` mode (permissive)

## CI/CD Workflows

### `.github/workflows/ci.yml` (Main CI)

Runs on push to `main` and all PRs:
1. Setup Node 18.18.2 + pnpm 10
2. `pnpm install`
3. `pnpm lint`
4. `pnpm typecheck`
5. `pnpm build`

**⚠️ Tests NOT run in CI.** Only lint, typecheck, build.

### `.github/workflows/playwright.yml`

Manual workflow dispatch for E2E tests. Requires `base_url` input.

### `.github/workflows/supabase-deploy.yml`

Deploys Edge Functions to Supabase. Requires project ref + secrets.

## Common Patterns

### Making Changes

1. **Always run `pnpm install` first** if dependencies might have changed
2. **Check current state:** `pnpm lint && pnpm typecheck`
3. **Make minimal changes** to files
4. **Test your changes:** `pnpm test` (or specific test file)
5. **Lint + typecheck again:** `pnpm lint && pnpm typecheck`
6. **Build if UI changes:** `pnpm build` (or `pnpm dev` to preview)

### Adding Dependencies

```bash
# Add to root workspace
pnpm add <package>

# Add to specific workspace
pnpm --filter <workspace> add <package>

# Examples:
pnpm --filter agents-service add express
pnpm --filter @icupa/ui add lucide-react
```

### Supabase Changes

- **Migrations:** Add new file in `supabase/migrations/` with timestamp prefix
- **Edge Functions:** Located in `supabase/functions/`, deployed via `scripts/supabase/deploy-functions.sh`
- **Types:** Regenerate with `supabase gen types typescript --schema public > src/integrations/supabase/types.ts`

### Component Development

- **Radix UI components:** Already installed, use from `@radix-ui/react-*`
- **Tailwind classes:** Use Tailwind utility classes (configured in `tailwind.config.ts`)
- **Icons:** Use `lucide-react`
- **Forms:** Use `react-hook-form` + `@hookform/resolvers` + `zod`

## Testing

### Unit Tests (Vitest)

- **Location:** Co-located with source (`.test.ts`, `.test.tsx`) or in `tests/`
- **Run:** `pnpm test`
- **Watch:** `vitest` (interactive mode)
- **Config:** `vite.config.ts` (test section) + `vitest.setup.ts`

### E2E Tests (Playwright)

- **Location:** `tests/playwright/specs/*.spec.ts`
- **Run:** `pnpm test:e2e`
- **Config:** `tests/playwright/playwright.config.ts`

### SQL Tests

- **Location:** `supabase/tests/*.sql`
- **Run:** `pnpm supabase:test` or `supabase db test`

## Key Files Reference

- **`package.json`**: All workspace scripts, dependencies
- **`pnpm-workspace.yaml`**: Workspace packages config
- **`vite.config.ts`**: Vite + Vitest config, aliases
- **`eslint.config.js`**: Linting rules
- **`tsconfig.base.json`**: TypeScript path aliases
- **`supabase/config.toml`**: Supabase project config
- **`scripts/ci/check-supabase-env.mjs`**: Validates required env vars before build
- **`scripts/ci/reset-supabase-test-db.mjs`**: Resets test database (pretest hook)

## Agent-Specific Guidance

1. **Trust these instructions.** Only search/explore if information is incomplete or incorrect.
2. **Always use `pnpm`**, never `npm`. The project is a pnpm workspace.
3. **Run `pnpm lint && pnpm typecheck`** before and after changes to catch issues early.
4. **Ignore pre-existing lint/test failures** unless you're fixing them specifically.
5. **Make minimal changes.** Don't refactor or "improve" unrelated code.
6. **Environment variables are required for builds.** Copy `.env.example` to `.env.local` if missing.
7. **Supabase local stack requires Docker.** If Docker isn't available, tests will gracefully skip Supabase-dependent tests.
8. **The repository has multiple apps/workspaces.** Most work happens in `src/`, `apps/web/`, or `packages/`.
9. **CI only runs lint/typecheck/build**, not tests. Ensure your changes pass `pnpm lint && pnpm typecheck && pnpm build`.
10. **When in doubt, run `pnpm verify`** (lint + typecheck + test) to validate your changes.
