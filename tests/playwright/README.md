# Phase 10 Playwright Suite Scaffold

This directory hosts the end-to-end automation artefacts maintained by the Phase 10 QA vendor. The structure matches the outsourcing playbook so ICUPA Core can accept deliverables without additional plumbing.

## Directory layout

```
tests/playwright/
├── README.md              # Guidance for contributors and vendors
├── playwright.config.ts   # Base configuration consumed by @playwright/test
├── specs/                 # Vendor-provided test suites grouped by surface
├── fixtures/              # Optional shared helpers (data builders, selectors)
└── reports/               # Local execution reports (gitignored)
```

The `specs` folder is pre-seeded with placeholder suites that exercise the diner, merchant, and admin journeys. Vendors should replace the placeholder expectations with real flows that align with the acceptance criteria defined in [docs/outsourcing/phase10-outsourcing.md](../../docs/outsourcing/phase10-outsourcing.md).

## Running locally

1. Install dependencies (installs Playwright browsers on first run):

   ```sh
   npm ci
   npx playwright install
   ```

2. Set the base URL. Playwright reads the deployment under test from the `PLAYWRIGHT_BASE_URL` environment variable and falls back to the local dev server when unset.

   ```sh
   export PLAYWRIGHT_BASE_URL="http://localhost:5173"
   ```

3. Execute the suites:

   ```sh
   npm run test:e2e
   ```

Reports and traces are written to `artifacts/phase10/playwright` to simplify CI retention policies. Local artefacts are ignored via `.gitignore`.

## CI integration

The GitHub Actions workflow includes a `playwright` job that runs automatically whenever the `PLAYWRIGHT_BASE_URL` secret is populated. The job installs browsers with `npx playwright install --with-deps` and uploads the trace archive as an artifact named `phase10-playwright`. Vendors only need to provide the suite implementations.

## Accessibility scans

Phase 10 requires axe-core accessibility coverage embedded in the E2E flows. Vendors should extend the provided placeholders with [`@axe-core/playwright`](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright) and export the raw reports to `artifacts/phase10/playwright/axe`.

## Coding conventions

- Prefer [testing-library](https://testing-library.com/docs/playwright-testing-library/intro/) queries to avoid brittle selectors.
- Model journeys by surface (`diner`, `merchant`, `admin`) to keep ownership clear.
- Keep flaky retries ≤ 2 and document known issues in the Linear ticket linked to the test.
- Store shared selectors and domain helpers in `fixtures/`.

Questions from vendors should be posted in `#qa-automation` with a link to the failing spec and associated trace.
