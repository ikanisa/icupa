# Dependency Vulnerability Report

## Summary
`pnpm audit` flagged multiple high-severity advisories affecting all PWAs through shared dependencies. Focus on patching `next` and transitive packages (`postcss`, `node-forge`, `tar`) and enabling automated updates.

## Advisories
| Module | Severity | CVEs | Affected Packages | Action |
| --- | --- | --- | --- | --- |
| next | High | CVE-2024-46982, CVE-2024-44000, CVE-2024-4068, CVE-2024-43790 | `apps/vendor`, `apps/admin`, `apps/client`, `apps/web`, `apps/ecotrips` UI package | Upgrade to latest 14.x/16.x patch (>=14.2.20 / >=16.0.3) and rebuild. |
| postcss | High | CVE-2024-44290 | Tailwind toolchain across all apps | Bump Tailwind stack to version using PostCSS >=8.4.49. |
| node-forge | Moderate | CVE-2022-24771 | Legacy dependency via `selfsigned` in local tooling | Remove unused packages or upgrade to node-forge >=1.3.1. |
| tar | Moderate | CVE-2025-64118 | pnpm extract utilities | Update `tar` to >=6.2.1 via package manager upgrade. |

## Remediation Plan
1. Run `pnpm up next@latest` in each workspace (`apps/*`, `packages/*`) and rerun regression tests.
2. Pin PostCSS/Tailwind versions across workspaces to patched releases.
3. Enable Renovate or Dependabot with security updates triaged weekly.
4. Add `pnpm audit --prod --fix --json` to CI, failing on high/critical.
5. Publish SBOM (`audit/sbom.cdx.json`) to artifact storage for SLSA attestations.
