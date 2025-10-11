# Contributing to ICUPA

Thanks for helping evolve the ICUPA platform. Before opening a pull request, please follow the workflow below to keep the codebase healthy and consistent.

## 1. Environment

- Copy `.env.example` → `.env.local` and `agents-service/.env.example` → `agents-service/.env`.
- Start the Supabase stack with `supabase start` and apply seed data via `supabase db reset` (or `supabase db push` + `supabase db seed` for existing instances).
- Run `npm install` in the project root and `npm install` inside `agents-service/` if you are working on the agent runtime.

## 2. Coding standards

- The repository uses the flat ESLint config in `eslint.config.js`.
- Format TypeScript files with `npm run format` (which runs ESLint in `--fix` mode).
- Keep changes additive unless you have explicit alignment with the project owners.
- Prefer co-locating hooks, components, and tests inside their feature “module” folders (`apps/web/src/modules/…` once the refactor lands).

## 3. Pre-flight checks

Before you push or open a PR:

```bash
# Lint, type-check, and run the Vitest suite
npm run verify

# Optional but encouraged
npm run test:e2e           # Playwright journeys (requires browsers)
supabase db test           # SQL / RLS regression tests
```

For agent-service changes, also run:

```bash
npm run dev:agents         # starts the Fastify endpoint locally
npm --prefix agents-service test
```

## 4. Commit hygiene

- Keep commits focused; avoid bundling unrelated changes.
- Reference Jira/Trello tickets (or the relevant GitHub issue) in the commit message body when applicable.
- After rebasing, re-run `npm run verify` to ensure no regressions slipped in.

## 5. Pull request checklist

- [] Tests passing (`npm run verify`)
- [] Supabase migration applied locally (when schema changes are present)
- [] Relevant docs updated (`docs/` or README snippets)
- [] Feature flags / kill switches accounted for if new functionality ships
- [] If Playwright specs changed, attach the HTML report or summary

Thanks again for contributing! Reach out in the engineering Slack channel (`#icupa-dev`) if you have questions or need a design review.
