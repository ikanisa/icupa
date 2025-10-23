# Branching Workflow

The repo now maintains a canonical `main` branch that is created directly from the long-lived `work` integration branch. `work` remains the staging ground for stacked feature work, while `main` is the protected release branch that mirrors the state we intend to deploy to Vercel.

## Branch Roles
- `main`: canonical, deployment-ready branch. Tag releases and create production deploys from here.
- `work`: integration branch used for day-to-day collaboration. Before cutting a release, sync it with `main` and rebase feature branches to match.
- `feature/*`: short-lived topic branches that must always be rebased on top of the latest `main` before opening a pull request.

## Daily Flow
1. Audit the repo state: `git branch -a` shows active local branches, and `git remote show origin` verifies remote tracking (currently no `origin` remote is configured; add one with `git remote add origin <url>` when ready to push upstream).
2. Create feature branches from `main`: `git checkout -b feature/<slug> main`.
3. Keep feature branches current by rebasing: `git fetch origin` (if configured) then `git rebase main`.
4. Run `scripts/check-branch-readiness.sh` before requesting review to lint, test, and build the workspaces that ship to production.
5. Merge through fast-forward only: `git checkout main && git merge --ff-only feature/<slug>` (or enable the FF-only mode in the hosting provider/PR settings). If a fast-forward merge is not possible, rebase again until it is.
6. Update `work` from `main` after every deploy so the staging branch continues to mirror production.

## Conflict Resolution
- During rebases resolve conflicts locally, rerun the readiness script, and amend before continuing with `git rebase --continue`.
- Never force-push `main`; force pushes are reserved for feature branches while cleaning up history prior to merge.
- Prefer small, reviewable commits that pass CI individually to keep the linear history healthy.

## Automation Hooks
- CI should invoke `scripts/check-branch-readiness.sh` on every push to `main`, `work`, and any `feature/*` branches.
- Branch protection on `main` must require the readiness script (see `ops/PRODUCTION_READINESS.md`), successful preview deployments from Vercel, and manual approval before release.

Document owners: platform team. Update this file whenever branching rules evolve.
