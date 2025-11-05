# Admin Console Vercel Configuration

This document captures the authoritative configuration for the `apps/admin` Next.js project when deployed to Vercel. It should be updated whenever build commands, secrets, or domains change.

## Project Metadata

- **Repository root**: `apps/admin`
- **Framework**: Next.js 16 (App Router)
- **Install command**: `pnpm install --frozen-lockfile`
- **Build command**: `pnpm --filter @icupa/admin build`
- **Production start**: `node .next/standalone/server.js` (required because `output: "standalone"` is enabled)
- **Output directory**: `.next`
- **Linked Git repo**: `icupa/icupa` (monorepo)

To initialise or re-link the project run:

```bash
cd apps/admin
vercel link --project icupa-admin --scope icupa
```

## Environment Variable Mapping

| Variable | Vercel secret | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `supabase-url` | Shared Supabase instance URL surfaced to the browser. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `supabase-anon-key` | Anonymous Supabase key scoped to row-level policies. |
| `NEXT_PUBLIC_AGENTS_URL` | `agents-base-url` | Public HTTPS endpoint for the Agents service. |
| `NEXT_PUBLIC_APP_URL` | _literal_ `https://admin.icupa.dev` | Used for absolute links and metadata tags. |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabase-service-role-key` | Server-only Supabase key injected as an encrypted secret. |

Secrets should be created with:

```bash
vercel env add <secret-name> production
vercel env add <secret-name> preview
vercel env add <secret-name> development
```

After provisioning secrets, sync them locally for CI parity:

```bash
vercel env pull --environment=production --token $VERCEL_TOKEN
```

## Domains

- **Production**: `admin.icupa.dev`
- **Preview aliases**: auto-generated (`admin-git-<branch>.icupa.vercel.app`) with optional friendly alias `preview-admin.icupa.dev`.

Configure the production alias with:

```bash
vercel domains add admin.icupa.dev
vercel alias set icupa-admin.vercel.app admin.icupa.dev
```

## Deployment Flow

1. Ensure the workspace is linked and secrets are present (`vercel link`, `vercel env pull`).
2. Run `pnpm --filter @icupa/admin build` locally or in CI (mirrors Vercel build settings).
3. Deploy using `vercel deploy --prebuilt` once the build folder exists, or rely on CI to trigger `vercel deploy` automatically.
4. Promote to production with `vercel deploy --prod` after smoke tests pass.
5. If a rollback is required, execute `vercel rollback <previous-deployment-url>`.

## Post-Deploy Verification

Run the smoke checklist immediately after promotion:

```bash
curl -I https://admin.icupa.dev/login
curl -I https://admin.icupa.dev/
curl -I https://admin.icupa.dev/tenants
```

Document outcomes in `docs/runbooks/admin.md` under **Rollout Notes**.
