# Atlas Integration Status & Phased Tasks

## Current Implementation Snapshot
- **Atlas base tokens** live in `app/app/globals.css`, defining the dark canvas palette, rounded radii, and UI primitives for inputs, cards, and buttons to mimic the ChatGPT Atlas look.【F:app/app/globals.css†L1-L76】
- **Root layout** wraps all routes in a `.container` panel and exposes the Atlas copy deck, but existing feature pages (e.g., `app/app/page.tsx`) still render their own full-width Tailwind shells that bypass the new container hierarchy.【F:app/app/layout.tsx†L1-L26】【F:app/app/page.tsx†L1-L120】
- **Atlas check route** (`/atlas-check`) successfully mounts the design tokens and verifies that browser-side Supabase credentials are present; it currently stops at reporting readiness and does not surface data from Supabase tables.【F:app/app/atlas-check/page.tsx†L1-L40】
- **Supabase browser helper** instantiates `createBrowserClient` with the anonymous key, but nothing in the UI invokes it yet beyond the `/atlas-check` health probe.【F:app/lib/supabaseBrowser.ts†L1-L11】
- **Lead capture flow** keeps its Tailwind-driven styling and continues to POST into the API route, which still relies on the service-role key and legacy fallback semantics rather than a shared Supabase client factory.【F:app/app/components/LeadCaptureForm.tsx†L1-L120】【F:app/app/api/leads/route.ts†L1-L409】
- **Environment scaffolding** exists via `app/.env.local.example`, but the Vercel-ready manifest of required server secrets (service role, captcha, rate limiting, etc.) has not been added to the repository documentation.【F:app/.env.local.example†L1-L4】【F:app/app/api/leads/route.ts†L201-L409】

## Gaps to Close
1. Atlas tokens are not yet wired into the hero, form, and itinerary surfaces, leaving two competing design systems in production.
2. The Supabase browser client is unused beyond smoke testing; no provider, hooks, or caching boundaries expose data to the UI.
3. The lead API still owns Supabase connection logic and expects the service-role key, preventing parity between client previews and production deployments.
4. There is no consolidated ops checklist to push the Atlas update through linting, testing, and Vercel preview verification under the new dependencies.

## Phased Task Breakdown

### Phase 1 – Normalize Atlas Shell Across Pages
- Audit all `app/app/**` routes and components that ship Tailwind-led shells; for each, replace ad-hoc wrappers with the shared `.container` and `.card` primitives while preserving semantic structure.
- Convert prominent Tailwind utility clusters (hero sections, trust panels, lead forms) into Atlas token equivalents by moving styles into CSS modules or inline styles that reference `var(--*)` tokens.
- Update component-level stories/tests (if any) to reflect the new classNames and ensure regression coverage for focus states and accessibility copy.
- Backfill documentation in `README.md` or `docs/` with the Atlas design rationale and token usage guidelines to keep future components consistent.

### Phase 2 – Productize Supabase Access
- Introduce a shared Supabase client factory for server components (`lib/supabaseServer.ts`) that centralizes service-role usage with typed table helpers, mirroring the browser helper’s ergonomics.
- Wrap the app in a lightweight provider (e.g., `SupabaseContext`) that memoizes `getSupabaseBrowser`, surfacing hooks like `useSupabase` for components that need realtime or query access.
- Replace the legacy `/api/leads` insert path with calls into Supabase edge functions or RLS-enabled tables; ensure the browser flow can fall back to a signed function call without embedding the service key.
- Document required environment variables in `app/README.md` (and create a Vercel environment table) covering anon/service keys, captcha tokens, and rate-limit secrets so deployment owners can configure them safely.

### Phase 3 – QA, Tooling, and Deployment Readiness
- Fix the failing lint workflow by upgrading the Next.js lint bridge (`scripts/run-next-lint.mjs`) or pinning the compatible eslint parser bundle so `npm run lint` succeeds locally and in CI.
- Refresh `package-lock.json` under the workspace after dependency adjustments, then run `npm run check` to exercise lint + Playwright smoke tests with the Atlas shell in place.
- Capture before/after screenshots for the homepage, lead form, and `/atlas-check` to attach in the PR and confirm dark-mode accessibility targets (contrast AA on buttons and inputs).
- Coordinate a Vercel preview deployment, validating that Supabase credentials (anon + service role) are wired through project settings and that `/atlas-check` reports readiness in the preview environment.

### Phase 4 – Rollout & Monitoring
- Update `DEPLOYMENT_READINESS_REPORT.md` with Atlas-specific regression items, Supabase environment validation notes, and escalation paths for outages.
- Configure lightweight logging (e.g., Supabase `logflare` integration or Vercel `vc env pull`) to monitor lead submissions post-launch, ensuring audit tables populate correctly.
- Draft a rollback playbook outlining how to re-enable the previous Tailwind theme (feature flag or branch revert) if Atlas adoption introduces blocking regressions.
- Prepare release notes summarizing Atlas visual changes and Supabase integration updates for customer success and marketing stakeholders.
