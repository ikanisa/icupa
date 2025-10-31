# Contributing to ICUPA

Thanks for helping evolve the ICUPA platform. Before opening a pull request, please follow the workflow below to keep the codebase healthy and consistent.

## 1. Environment

- Copy `.env.example` → `.env.local` and `agents-service/.env.example` → `agents-service/.env`.
- Start the Supabase stack with `supabase start` and apply seed data via `supabase db reset` (or `supabase db push` + `supabase db seed` for existing instances).
- Run `npm install` in the project root and `npm install` inside `agents-service/` if you are working on the agent runtime.

## 2. Coding standards

- The repository uses the flat ESLint config in `eslint.config.js`.
- Format TypeScript files with `npm run format` (which runs Prettier).
- Lint and auto-fix issues with `npm run lint:fix`.
- Keep changes additive unless you have explicit alignment with the project owners.
- Prefer co-locating hooks, components, and tests inside their feature "module" folders (`apps/web/src/modules/…` once the refactor lands).

### Pre-commit hooks

The repository uses Husky to enforce code quality checks before commits:

- **Automatic linting and formatting**: The pre-commit hook runs `lint-staged`, which automatically:
  - Runs ESLint with `--max-warnings=0` on staged TypeScript/JavaScript files
  - Runs Prettier on staged files (TypeScript, JavaScript, JSON, Markdown, CSS, etc.)
  - Formats code to match the repository's style guide (100-char line length, double quotes, etc.)

- **Setup**: Husky hooks are automatically installed when you run `npm install`. The pre-commit hook is defined in `.husky/pre-commit`.

- **Bypass (not recommended)**: If you need to bypass the pre-commit hook in exceptional cases, use `git commit --no-verify`, but be sure to fix any issues before opening a PR.

- **What's checked**: The `lint-staged` configuration in `package.json` defines which files are checked and what commands run on them.

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
