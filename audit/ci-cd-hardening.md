# CI/CD Hardening Plan

## Current Pipeline
- pnpm scripts for linting, typechecking, unit tests, e2e, Lighthouse (`test:perf`).
- No enforced SBOM publishing or dependency scanning gate.
- No branch protection rules documented; merges to `main` may skip tests.

## Required Enhancements
1. **Pipeline Stages**
   - `lint` → `typecheck` → `test` → `test:e2e` → `build` → `audit` (pnpm audit) → `lhci` → `sbom` → `deploy`.
   - Use GitHub Actions with matrix across PWAs (admin, staff) to parallelize builds.
2. **Security Gates**
   - `pnpm audit --prod --json` fail on High/Critical.
   - `gitleaks` or `secretlint` stage for secrets scanning.
   - Container/IaC scans if deploying Docker (Trivy) and Supabase config validation.
3. **Supply Chain**
   - Generate SBOM (`audit/sbom.cdx.json`) and upload as artifact; sign build with cosign.
   - Use `npm pkg set packageManager="pnpm@x.y.z"` to lock package manager version.
   - Enable Dependabot/ Renovate for automatic security PRs.
4. **Quality Gates**
   - Enforce coverage threshold (eg 80%) via Vitest + coverage report.
   - Run Playwright offline tests to ensure PWA readiness.
   - Add Lighthouse CI for each PWA with target scores (Performance ≥0.85, PWA ≥0.9).
5. **Deployment Safety**
   - Implement preview environments per PR (Vercel) with smoke tests.
   - Adopt canary deploy toggle script (`scripts/release/canary-toggle.mjs`) with automated rollback.
   - Require manual approval for production after successful staging verification.
6. **Infrastructure as Code**
   - Store Supabase config in repo (`supabase/config.toml`) and validate via `supabase db lint`.
   - Add Terraform/Helm scanning if introduced.
7. **Branch Protection**
   - Require code review, signed commits, status checks for `lint`, `typecheck`, `test`, `test:e2e`, `lhci`, `audit` before merge to `main`.

## Sample GitHub Actions Workflow
```yaml
name: ci
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - name: Install
        run: pnpm install --frozen-lockfile
      - name: Lint
        run: pnpm lint
      - name: Typecheck
        run: pnpm typecheck
      - name: Unit tests
        run: pnpm test -- --coverage
      - name: E2E tests
        run: pnpm test:e2e
      - name: Build apps
        run: pnpm --filter @icupa/vendor build && pnpm --filter @icupa/admin build
      - name: Lighthouse
        run: pnpm test:perf
      - name: Security audit
        run: pnpm audit --prod --json
      - name: SBOM
        run: node scripts/ci/generate-sbom.mjs
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: sbom
          path: audit/sbom.cdx.json
```
