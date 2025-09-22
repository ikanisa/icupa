# Offline Mode

This repository currently operates in an offline-first configuration. Network access for installing npm packages, Deno modules, or fetching binaries is disabled. Development and CI pipelines use local fixtures and mock endpoints for validation.

## Why
- Sandbox network restrictions prevent reaching public registries.
- CI and local scripts must complete without external downloads.

## Working Offline
- Use the mock Supabase Edge Functions under `supabase/functions/ops-*` for Ops Console data.
- Rely on fixtures in `ops/fixtures/*.json` while services are offline.
- CI runs format checks and Supabase migration dry runs only.

## Re-enabling Network Operations
1. Restore outbound access to npm, Deno, and Supabase registries.
2. Remove or unset the `CI_OFFLINE=1` environment flag.
3. Re-run dependency installs (`npm install`, `deno cache`, etc.) and validate builds.
4. Update CI to re-enable the download steps.

Until network access is restored, keep using the mock APIs and fixtures described above.
