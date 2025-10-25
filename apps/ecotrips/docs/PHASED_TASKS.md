# Phased Task Checklist

Use this tracker to jump directly into each outstanding task identified during integration planning.

## Quick Start Links
- [Remote inventory is missing, blocking a trustworthy integration baseline](#issue-1-remote-inventory-is-missing-blocking-a-trustworthy-integration-baseline)
- [Dependency audit lacks actionable workspace coverage](#issue-2-dependency-audit-lacks-actionable-workspace-coverage)
- [Cross-branch reconciliation is still outstanding](#issue-3-cross-branch-reconciliation-is-still-outstanding)
- [Deployment readiness for Vercel has not been validated](#issue-4-deployment-readiness-for-vercel-has-not-been-validated)
- [PR workflow requires end-to-end validation](#issue-5-pr-workflow-requires-end-to-end-validation)

### New: Interactive phase control tower

- Visit [`/phases`](../app/phases) in the Next.js app to launch the live checklist with clipboard-ready commands.
- Each task mirrors the stubs below and records an inline status (`Not started → In progress → Completed`).
- The **Start Task** buttons copy terminal commands automatically; the **Mark complete** button logs progress for reviewers.

## Issue 1: Remote inventory is missing, blocking a trustworthy integration baseline
<a id="issue-1-remote-inventory-is-missing-blocking-a-trustworthy-integration-baseline"></a>
[Start Task](#task-issue-1)

### Suggested Tasks
- Reconnect origin and capture authoritative branch inventory — [▶️ Start Task](#task-issue-1)
- Document remote configuration prerequisites for CI environments — [▶️ Start Task](#task-issue-1-prereqs)

### Task Steps
<a id="task-issue-1"></a>
:::task-stub{title="Reconnect origin and capture authoritative branch inventory"}
1. Run `git remote -v` and, if empty, add the canonical origin URL supplied by the team.
2. Execute the preflight commands from `SESSION_STATUS.md` to fetch all refs (`git fetch --all --prune --tags`) and detect the default branch.
3. Populate `.ci/branches.txt` and `.ci/ahead_behind.txt` using the `git branch -r` and `git for-each-ref` commands listed in the original runbook.
4. Record the results in `.ci/INTEGRATION_REPORT.md`, replacing the placeholder notes about missing remote access.:::

<a id="task-issue-1-prereqs"></a>
:::task-stub{title="Document remote configuration prerequisites"}
1. Capture the credentials or network requirements needed to reach the canonical origin (VPN, SSH keys, PAT scopes).
2. Record the steps in `SESSION_STATUS.md` under a new "Remote Access" subsection so teammates can reproduce the setup.
3. Cross-link the documentation from `.ci/INTEGRATION_REPORT.md` to highlight any blockers that remain.
4. Escalate unresolved access gaps to the release manager before attempting multi-branch integration.:::

## Issue 2: Dependency audit lacks actionable workspace coverage
<a id="issue-2-dependency-audit-lacks-actionable-workspace-coverage"></a>
[Start Task](#task-issue-2)

### Suggested Tasks
- Regenerate dependency inventory with workspace coverage — [▶️ Start Task](#task-issue-2)
- Annotate remediation items directly in the inventory report — [▶️ Start Task](#task-issue-2-remediation)

### Task Steps
<a id="task-issue-2"></a>
:::task-stub{title="Run and enhance dependency inventory across workspaces"}
1. Execute `node scripts/dependency-inventory.mjs` to regenerate `.ci/DEPENDENCY_INVENTORY.md`, ensuring all `apps/*`, `packages/*`, and `ops/*` manifests are captured.
2. Update the script to flag mismatched versions of shared dependencies and workspace-specific Node/Next.js requirements, emitting them under a “Warnings” section.
3. Cross-check the findings against `package.json` workspace definitions and document remediation items directly in the inventory report.:::

<a id="task-issue-2-remediation"></a>
:::task-stub{title="Document dependency remediation follow-up"}
1. Review the “Warnings” section emitted by the inventory script and group items by owning workspace or package.
2. For each warning, propose an action plan (upgrade, dedupe, replace) and add it as a checklist under the corresponding entry in `.ci/DEPENDENCY_INVENTORY.md`.
3. Share the remediation summary in `DEPLOYMENT_READINESS_REPORT.md` so deployment owners can schedule updates.
4. Track completion status using GitHub issues or the team’s project board, linking back to the inventory entry for context.:::

## Issue 3: Cross-branch reconciliation is still outstanding
<a id="issue-3-cross-branch-reconciliation-is-still-outstanding"></a>
[Start Task](#task-issue-3)

### Suggested Tasks
- Create the integration branch and merge active remotes — [▶️ Start Task](#task-issue-3)
- Capture conflict resolutions and policy deviations — [▶️ Start Task](#task-issue-3-conflicts)

### Task Steps
<a id="task-issue-3"></a>
:::task-stub{title="Create integration branch and merge active remotes"}
1. Create `integration/merge-all-branches-<date>` from `main` once it is freshly pulled.
2. For each candidate branch discovered in `.ci/branches.txt`, tag `pre-merge/<branch>/<timestamp>` and attempt a rebase onto the integration branch, falling back to merges per policy.
3. Resolve conflicts following `AGENTS.md` guidance (env files, dependency manifests, lockfiles).
4. After integrating all branches, regenerate `package-lock.json`, run `npm run test:ci`, and commit the results with the templated message.:::

<a id="task-issue-3-conflicts"></a>
:::task-stub{title="Log conflict outcomes and policy exceptions"}
1. After each merge or rebase, record files that required manual attention in `.ci/INTEGRATION_REPORT.md` under a new "Conflict Log" heading.
2. Highlight any deviations from the prescribed conflict resolution policies (e.g., when neither side could be preserved without refactoring).
3. Tag the original branch authors using `git shortlog -sne -- <path>` to assign follow-up reviews on contentious sections.
4. Attach diffs or screenshots if binary assets were duplicated to satisfy the policy.:::

## Issue 4: Deployment readiness for Vercel has not been validated
<a id="issue-4-deployment-readiness-for-vercel-has-not-been-validated"></a>
[Start Task](#task-issue-4)

### Suggested Tasks
- Verify Vercel preview deployment pipeline — [▶️ Start Task](#task-issue-4)
- Prepare environment variable audit for Vercel projects — [▶️ Start Task](#task-issue-4-env-audit)

### Task Steps
<a id="task-issue-4"></a>
:::task-stub{title="Verify Vercel deployment pipeline after integration"}
1. Ensure Next.js apps in `app/` or `apps/*` build successfully with `npm run build --workspace <app>`.
2. Update `.vercel/project.json` or equivalent (if present) with the new integration branch and environment variables required by Supabase per `.env.example`.
3. Trigger a preview deployment via Vercel CLI or dashboard, capturing logs for inclusion in the updated integration report.
4. Document the deployment verification steps and outcomes in `DEPLOYMENT_READINESS_REPORT.md`.:::

> 💡 If Turbopack crashes during the build, capture the automatically generated webpack fallback logs from `app/scripts/run-next-build.mjs` and attach them to the report for reviewers.

<a id="task-issue-4-env-audit"></a>
:::task-stub{title="Audit Vercel environment configuration"}
1. Enumerate required Supabase, authentication, and analytics environment variables from `.env.example` and the deployment checklist.
2. Verify each variable is configured in the Vercel project across `Production`, `Preview`, and `Development` environments.
3. Capture screenshots or CLI output (redacting secrets) and store them under `DEPLOYMENT_READINESS_REPORT.md`.
4. Note any missing variables and assign owners to supply the values before the next deployment.:::

## Issue 5: PR workflow requires end-to-end validation
<a id="issue-5-pr-workflow-requires-end-to-end-validation"></a>
[Start Task](#task-issue-5)

### Suggested Tasks
- Prepare reviewed PR back to main — [▶️ Start Task](#task-issue-5)
- Automate reviewer notifications and checklist updates — [▶️ Start Task](#task-issue-5-automation)

### Task Steps
<a id="task-issue-5"></a>
:::task-stub{title="Prepare reviewed PR back to main"}
1. Push the integration branch and open a PR targeting `main`, attaching the refreshed `.ci/INTEGRATION_REPORT.md`.
2. Assign reviewers, linking to test artifacts and the dependency inventory for faster review.
3. Address review feedback, rerun `npm run test:ci`, and update the report before requesting final approval and merge.:::

<a id="task-issue-5-automation"></a>
:::task-stub{title="Automate reviewer notifications"}
1. Configure a PR template (if not already present) to include checklists for dependency review, conflict log review, and Vercel deployment status.
2. Set up CODEOWNERS or branch protection rules so key reviewers are auto-requested when the integration branch PR opens.
3. Draft a Slack or Teams notification snippet referencing the PR link and key artifacts, and include it in `.ci/INTEGRATION_REPORT.md` for reuse.
4. After automation is in place, note the process in `APPROVALS.md` so the release manager can audit notification coverage.:::

---

## Phase Cards (Clickable Start Tasks)

<div class="phase-cards">

<div class="phase-card">
  <h3>Phase 1 – Restore unit test dependencies</h3>
  <p><a href="#phase-1-start" class="phase-start-link">Start Task</a></p>
  <div class="phase-suggested">
    <strong>Suggested Task</strong>
    <p><a href="#phase-1-task" class="phase-view-link">View task</a></p>
  </div>
  <a id="phase-1-start"></a>
  <a id="phase-1-task"></a>
  :::task-stub{title="Restore missing immer dependency"}
  1. Inspect failing unit tests to confirm the missing dependency stack traces.
  2. Add the required `immer` version to the affected workspace `package.json` using `npm install --workspace <name> immer@latest`.
  3. Regenerate the lockfile (`npm install`) to capture the dependency addition.
  4. Re-run `npm run test --workspace <name>` to ensure the unit tests now pass.:::
</div>

<div class="phase-card">
  <h3>Phase 2 – Regression validation</h3>
  <p><a href="#phase-2-start" class="phase-start-link">Start Task</a></p>
  <div class="phase-suggested">
    <strong>Suggested Task</strong>
    <p><a href="#phase-2-task" class="phase-view-link">View task</a></p>
  </div>
  <a id="phase-2-start"></a>
  <a id="phase-2-task"></a>
  :::task-stub{title="Re-run quality gates after dependency fix"}
  1. Execute `npm run lint` and `npm run typecheck` at the repository root to verify static analysis passes.
  2. Trigger the full regression suite with `npm run test:ci` and capture the results artifact.
  3. If any regressions surface, bisect recent commits to identify the cause and document mitigation steps in `.ci/INTEGRATION_REPORT.md`.
  4. Attach the regression summary and test logs to the integration PR for reviewer visibility.:::
</div>

<div class="phase-card">
  <h3>Phase 3 – Deployment readiness</h3>
  <p><a href="#phase-3-start" class="phase-start-link">Start Task</a></p>
  <div class="phase-suggested">
    <strong>Suggested Task</strong>
    <p><a href="#phase-3-task" class="phase-view-link">View task</a></p>
  </div>
  <a id="phase-3-start"></a>
  <a id="phase-3-task"></a>
  :::task-stub{title="Validate Vercel preview before main merge"}
  1. Run `npm run build --workspace app` (or each Next.js app) to confirm production builds succeed.
  2. Use `vercel deploy --prebuilt` with the integration branch to generate a preview deployment.
  3. Verify environment variables align with `.env.example`, documenting any missing entries in `DEPLOYMENT_READINESS_REPORT.md`.
  4. Share the preview URL and validation notes in the integration PR prior to requesting approval.
  5. If Turbopack panics, rely on the automatic webpack fallback (`app/scripts/run-next-build.mjs`) and attach the successful webpack build logs to the readiness report.:::
</div>

<div class="phase-card">
  <h3>Phase 4 – Router-agent activation</h3>
  <p><a href="#phase-4-start" class="phase-start-link">Start Task</a></p>
  <div class="phase-suggested">
    <strong>Suggested Task</strong>
    <p><a href="#phase-4-task" class="phase-view-link">View task</a></p>
  </div>
  <a id="phase-4-start"></a>
  <a id="phase-4-task"></a>
  :::task-stub{title="Run router-agent rehearsals and smoke tests"}
  1. Execute `npm run test:observability` to confirm Supabase traces capture router-agent breadcrumbs.
  2. Run `npm run test:rehearsal` to exercise WhatsApp pricing, voice fallback, and GDPR logging rehearsals.
  3. Paste the JSON evidence from both commands into `DEPLOYMENT_READINESS_REPORT.md` under a new "Router-agent rehearsals" heading.
  4. Record any failures as blockers in the `/phases` dashboard before requesting deployment approval.:::
</div>

</div>

## Issue 6: Router-agent activation lacks launch controls
<a id="issue-6-router-agent-activation-lacks-launch-controls"></a>
[Start Task](#task-issue-6)

### Suggested Tasks
- Run router-agent smoke tests and rehearsals — [▶️ Start Task](#task-issue-6)
- Capture ChatKit preview sign-off — [▶️ Start Task](#task-issue-6-chatkit)
- Complete compliance audit coverage — [▶️ Start Task](#task-issue-6-compliance)

### Task Steps
<a id="task-issue-6"></a>
:::task-stub{title="Execute router-agent smoke and rehearsal suite"}
1. Run `npm run test:observability` to ensure the router-agent emits telemetry breadcrumbs and Supabase traces remain healthy.
2. Execute `npm run test:rehearsal` to validate WhatsApp pricing, voice fallback, and GDPR logging rehearsals.
3. Collect the console output and store it in `DEPLOYMENT_READINESS_REPORT.md` under "Router-agent rehearsals".
4. Flag any regressions inside `/phases` so reviewers can block the release until resolved.:::

<a id="task-issue-6-chatkit"></a>
:::task-stub{title="Publish ChatKit preview evidence"}
1. Generate the ChatKit preview (Figma or hosted sandbox) showing router-agent interactions and clipboard-ready prompts.
2. Drop annotated screenshots or URLs into `docs/releases/router-agent-activation.md` so stakeholders can review asynchronously.
3. Reference the preview link within `/phases` Phase 4 notes and confirm UI owners sign off on the state.
4. Capture sign-off details (name, date, outstanding feedback) in `DEPLOYMENT_READINESS_REPORT.md`.:::

<a id="task-issue-6-compliance"></a>
:::task-stub{title="Complete compliance audit checkpoints"}
1. Reconcile GDPR, privacy export, and audit logging requirements using `ops/privacy/DATAMAP.md` and Supabase audit tables.
2. Ensure router-agent prompts log `AUDIT` trails without storing raw PII by cross-checking `agents/observability.md`.
3. Summarize findings in `docs/releases/router-agent-activation.md` and surface any blockers to the compliance lead.
4. Update `DEPLOYMENT_READINESS_REPORT.md` with remediation owners and timelines before requesting the production deploy.:::

