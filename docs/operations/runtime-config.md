# Runtime Configuration & Secrets Handling

This guide documents how each ICUPA service consumes configuration, which variables are required, and how secrets must be managed across environments.

## Principles

- **12-factor compliance:** All configuration lives in environment variables.
- **No secrets in Git:** Use `.env.example` templates only for non-sensitive defaults.
- **Single source of truth:** Production secrets reside in Vault (or cloud secret manager) and are synced via GitHub Actions OIDC.
- **Rotation:** Secrets rotate at least every 90 days or immediately after suspected compromise.

## Configuration Matrix

| Service | Required Variables | Notes |
| ------- | ------------------ | ----- |
| Agents Service | `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `MEILI_MASTER_KEY`, `REDIS_URL`, `MINIO_ENDPOINT` | All injected via Kubernetes secret `icupa-runtime-secrets`. |
| Admin PWA | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_AGENTS_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server actions) | Build pipeline ensures public keys only exposed client-side. |
| Client PWA | Same as Admin | |
| Vendor PWA | Same as Admin | |
| Web PWA | Same as Admin | |
| Voice Agent | `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PUBLIC_WS_URL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Twilio credentials stored only in secret manager. |
| OCR Converter | `PORT`, optional `STORAGE_BUCKET` | Designed for internal use; no external credentials. |
| Ecotrips App | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Follows monorepo `.env` template. |

## Environment Templates

Each application now includes a `.env.example` file. Copy to `.env.local` for local development:

```bash
cp apps/client/.env.example apps/client/.env.local
```

Never commit the populated file; `.gitignore` already excludes `.env*` patterns.

## Secrets Handling Workflow

1. Secrets live in Vault → `secrets/icupa/<env>/<service>/<key>`.
2. GitHub Actions retrieves secrets using OIDC and writes them to temporary files during deploy jobs.
3. Kubernetes secrets are applied with `kubectl` or Helm and labeled with `icupa.dev/rotation-window`.
4. When rotating a secret:
   - Update Vault.
   - Trigger the `Continuous Delivery` workflow with `workflow_dispatch` to sync into the cluster.
   - Update documentation if variable names change.

## Auditing

- Run `scripts/security/lint-secrets.mjs` weekly (future work) to ensure no plaintext credentials exist in the repo.
- GitHub secret scanning is enabled and must stay active.

## Incident Response

If a secret is exposed:

1. Revoke the credential immediately.
2. Replace the secret in Vault and re-run deployments.
3. Update the `security@icupa.app` incident log.
4. Perform a post-incident review within 48 hours.
