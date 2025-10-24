"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type TaskState = "idle" | "in-progress" | "done";

type TaskDefinition = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  commands?: string[];
  resources?: { label: string; href: string }[];
};

type PhaseDefinition = {
  id: string;
  title: string;
  description: string;
  highlight: string;
  tasks: TaskDefinition[];
};

const taskPhases: PhaseDefinition[] = [
  {
    id: "phase-1",
    title: "Phase 1 · Baseline restoration",
    description:
      "Reconnect the repository to its authoritative remotes and rebuild the shared dependency inventory so every later merge operates on fresh data.",
    highlight: "Stabilise metadata before touching long-lived branches.",
    tasks: [
      {
        id: "task-issue-1",
        title: "Reconnect origin and capture branch inventory",
        summary:
          "Ensure the workspace can see every remote branch and record the authoritative inventory files for reviewers.",
        steps: [
          "Run `git remote -v` and add the canonical origin URL if the list is empty.",
          "Fetch all refs with `git fetch --all --prune --tags` so branch data is current.",
          "Export `git branch -r --format=\"%(refname:short)\" | sort` to `.ci/branches.txt`.",
          "Capture ahead/behind data with `git for-each-ref --format=\"%(refname:short) %(ahead) %(behind)\" refs/remotes | sort` and save it to `.ci/ahead_behind.txt`.",
          "Update `.ci/INTEGRATION_REPORT.md` with the refreshed remote inventory and any blockers.",
        ],
        commands: [
          "git remote -v",
          "git remote add origin <git-url> # only if origin is missing",
          "git fetch --all --prune --tags",
          "git branch -r --format='%(refname:short)' | sort > .ci/branches.txt",
          "git for-each-ref --format='%(refname:short) %(ahead) %(behind)' refs/remotes | sort > .ci/ahead_behind.txt",
        ],
        resources: [
          {
            label: "Runbook entry",
            href: "/docs/phased-tasks#issue-1-remote-inventory-is-missing-blocking-a-trustworthy-integration-baseline",
          },
          { label: "Task stub", href: "/docs/phased-tasks#task-issue-1" },
        ],
      },
      {
        id: "task-issue-2",
        title: "Run and enhance dependency inventory across workspaces",
        summary:
          "Generate actionable dependency notes, highlighting mismatched runtime versions and remediation checklists.",
        steps: [
          "Execute `node scripts/dependency-inventory.mjs` to rebuild `.ci/DEPENDENCY_INVENTORY.md`.",
          "Review the new \"Warnings\" section and confirm mismatches are accurate for every workspace.",
          "Document remediation owners and next steps under each mismatch entry.",
          "Cross-link the report from `.ci/INTEGRATION_REPORT.md` for release review visibility.",
        ],
        commands: [
          "node scripts/dependency-inventory.mjs",
          "# review .ci/DEPENDENCY_INVENTORY.md",
        ],
        resources: [
          { label: "Runbook entry", href: "/docs/phased-tasks#issue-2-dependency-audit-lacks-actionable-workspace-coverage" },
          { label: "Task stub", href: "/docs/phased-tasks#task-issue-2" },
        ],
      },
    ],
  },
  {
    id: "phase-2",
    title: "Phase 2 · Integration execution",
    description:
      "Create a deterministic integration branch, resolve conflicts per policy, and log every reconciliation decision for auditors.",
    highlight: "Track conflict outcomes so reviewers can replay each merge.",
    tasks: [
      {
        id: "task-issue-3",
        title: "Create integration branch and merge active remotes",
        summary:
          "Spin up the dated integration branch and rebase or merge each candidate branch with automated policy enforcement.",
        steps: [
          "Branch from `main` into `integration/merge-all-branches-<date>` after pulling the latest commits.",
          "Tag each source branch with `pre-merge/<branch>/<timestamp>` before attempting a rebase or merge.",
          "Resolve conflicts using the documented env/dependency/prisma policies.",
          "Commit with the standard message template once each branch reconciles.",
        ],
        commands: [
          "git checkout main",
          "git pull --ff-only",
          "git checkout -b integration/merge-all-branches-$(date +%Y%m%d)",
          "while read branch; do git fetch origin \"$branch\"; git tag -f pre-merge/$branch/$(date +%Y%m%d-%H%M) origin/$branch; done < .ci/candidate_branches.txt",
        ],
        resources: [
          { label: "Runbook entry", href: "/docs/phased-tasks#issue-3-cross-branch-reconciliation-is-still-outstanding" },
          { label: "Task stub", href: "/docs/phased-tasks#task-issue-3" },
        ],
      },
      {
        id: "task-issue-3-conflicts",
        title: "Log conflict outcomes and policy exceptions",
        summary:
          "Document every manual decision so reviewers know where to focus their diff analysis.",
        steps: [
          "List all manually resolved files in the new \"Conflict Log\" section of `.ci/INTEGRATION_REPORT.md`.",
          "Note any deviations from the published conflict-resolution policies.",
          "Assign follow-up reviewers using `git shortlog -sne -- <path>` where ownership is unclear.",
          "Attach supporting screenshots or diff excerpts for duplicated assets.",
        ],
        commands: [
          "git shortlog -sne -- <conflicted-file>",
          "# update .ci/INTEGRATION_REPORT.md",
        ],
        resources: [
          { label: "Runbook entry", href: "/docs/phased-tasks#task-issue-3-conflicts" },
        ],
      },
    ],
  },
  {
    id: "phase-3",
    title: "Phase 3 · Deployment readiness",
    description:
    highlight: "Ship with confidence by exercising the preview pipeline end-to-end.",
    tasks: [
      {
        id: "task-issue-4",
        summary:
          "Trigger a fresh preview deployment and capture validation evidence for reviewers.",
        steps: [
          "Build each Next.js workspace locally with `npm run build --workspace <app>`.",
          "If Turbopack panics, capture the webpack fallback output from `app/scripts/run-next-build.mjs` and attach it to your evidence.",
          "Record the validation steps and outcomes in `DEPLOYMENT_READINESS_REPORT.md`.",
        ],
        commands: [
          "npm run build --workspace app",
        ],
        resources: [
          { label: "Task stub", href: "/docs/phased-tasks#task-issue-4" },
        ],
      },
      {
        id: "task-issue-4-env-audit",
        summary:
          "Confirm every required secret is populated across Production, Preview, and Development scopes.",
        steps: [
          "Enumerate required variables from `.env.example`.",
          "Document missing items and assign owners within `DEPLOYMENT_READINESS_REPORT.md`.",
        ],
        commands: [
          "# update DEPLOYMENT_READINESS_REPORT.md",
        ],
        resources: [
          { label: "Runbook entry", href: "/docs/phased-tasks#task-issue-4-env-audit" },
        ],
      },
      {
        id: "task-issue-5",
        title: "Prepare reviewed PR back to main",
        summary:
          "Bundle every artefact into a single integration PR and guide it through approval.",
        steps: [
          "Push the integration branch and open a PR targeting `main`, attaching `.ci/INTEGRATION_REPORT.md`.",
          "Request reviews from code owners and link dependency/test artefacts for context.",
          "Rerun `npm run test:ci` after addressing reviewer feedback before requesting merge.",
        ],
        commands: [
          "git push -u origin integration/merge-all-branches-$(date +%Y%m%d)",
          "gh pr create --base main --head integration/merge-all-branches-$(date +%Y%m%d) --title 'Merge: Reconcile all active branches into main' --body-file .ci/INTEGRATION_REPORT.md",
        ],
        resources: [
          { label: "Runbook entry", href: "/docs/phased-tasks#issue-5-pr-workflow-requires-end-to-end-validation" },
          { label: "Task stub", href: "/docs/phased-tasks#task-issue-5" },
        ],
      },
    ],
  },
  {
    id: "phase-4",
    title: "Phase 4 · Router-agent activation",
    description:
      "Exercise router-agent rehearsals, review ChatKit previews, and confirm compliance guardrails before launch.",
    highlight: "Validate agent routing evidence before enabling traffic.",
    tasks: [
      {
        id: "task-issue-6",
        title: "Execute router-agent smoke and rehearsal suite",
        summary:
          "Run observability and rehearsal scripts to verify WhatsApp pricing, voice fallback, and GDPR logging coverage.",
        steps: [
          "Run `npm run test:observability` to confirm Supabase traces capture router-agent telemetry.",
          "Execute `npm run test:rehearsal` to validate pricing, voice, and GDPR rehearsal evidence.",
          "Paste the outputs into `DEPLOYMENT_READINESS_REPORT.md` under a new \"Router-agent rehearsals\" heading.",
          "Escalate failures as Phase 4 blockers so reviewers halt the release until resolved.",
        ],
        commands: [
          "npm run test:observability",
          "npm run test:rehearsal",
        ],
        resources: [
          {
            label: "Runbook entry",
            href: "/docs/phased-tasks#task-issue-6",
          },
          {
            label: "Readiness report",
            href: "/docs/deployment-readiness-report",
          },
        ],
      },
      {
        id: "task-issue-6-chatkit",
        title: "Publish ChatKit preview evidence",
        summary:
          "Share annotated ChatKit previews that demonstrate router-agent interactions for stakeholders.",
        steps: [
          "Generate or collect the ChatKit preview URL or screenshots showcasing router-agent prompts.",
          "Document the assets in `docs/releases/router-agent-activation.md` for async review.",
          "Record designer and product sign-off details in `DEPLOYMENT_READINESS_REPORT.md`.",
        ],
        resources: [
          {
            label: "Runbook entry",
            href: "/docs/phased-tasks#task-issue-6-chatkit",
          },
          {
            label: "Release notes",
            href: "/docs/releases/router-agent-activation",
          },
        ],
      },
      {
        id: "task-issue-6-compliance",
        title: "Complete compliance audit checkpoints",
        summary:
          "Verify GDPR, privacy export, and audit logging safeguards prior to router-agent activation.",
        steps: [
          "Cross-check `ops/privacy/DATAMAP.md` against router-agent storage paths.",
          "Ensure `agents/observability.md` reflects the latest AUDIT logging patterns.",
          "Log remediation owners and due dates in `DEPLOYMENT_READINESS_REPORT.md`.",
        ],
        resources: [
          {
            label: "Runbook entry",
            href: "/docs/phased-tasks#task-issue-6-compliance",
          },
          {
            label: "Compliance notes",
            href: "/docs/releases/router-agent-activation",
          },
        ],
      },
    ],
  },
];

function formatCommands(commands?: string[]) {
  if (!commands || commands.length === 0) {
    return undefined;
  }
  return commands.join("\n");
}

export function PhaseTaskBoard() {
  const [taskStates, setTaskStates] = useState<Record<string, TaskState>>({});
  const [feedback, setFeedback] = useState<{ message: string; tone: "success" | "error" | "info" } | null>(null);

  const activeCount = useMemo(
    () => Object.values(taskStates).filter((state) => state === "in-progress").length,
    [taskStates],
  );

  async function startTask(task: TaskDefinition) {
    const nextState: Record<string, TaskState> = { ...taskStates, [task.id]: "in-progress" };
    setTaskStates(nextState);

    if (task.commands && task.commands.length > 0) {
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(formatCommands(task.commands) ?? "");
          setFeedback({
            message: `Copied ${task.commands.length} command${task.commands.length === 1 ? "" : "s"} to your clipboard.`,
            tone: "success",
          });
        } else {
          setFeedback({
            message: "Clipboard access is unavailable in this browser. Commands are listed with each task.",
            tone: "info",
          });
        }
      } catch (error) {
        console.error("Unable to copy commands", error);
        setFeedback({
          message: "We couldn't copy the commands automatically. Please run them manually from the task card.",
          tone: "error",
        });
      }
    } else {
      setFeedback({ message: "Task marked as in progress.", tone: "info" });
    }
  }

  function completeTask(taskId: string) {
    setTaskStates((prev) => ({ ...prev, [taskId]: "done" }));
    setFeedback({ message: "Great! Logged this task as completed.", tone: "success" });
  }

  function resetTask(taskId: string) {
    setTaskStates((prev) => ({ ...prev, [taskId]: "idle" }));
    setFeedback({ message: "Task reset. You can restart it at any time.", tone: "info" });
  }

  return (
    <div className="space-y-10">
      <div className="rounded-3xl border border-emerald-500/40 bg-slate-900/60 p-6 text-sm text-emerald-100/90">
        <p className="font-medium text-emerald-200">
          Use the buttons below to launch tasks. Commands copy to your clipboard automatically so you can drop them straight into
          your terminal.
        </p>
        <p className="mt-2">Active tasks: {activeCount}</p>
        {feedback ? (
          <p
            role="status"
            aria-live="polite"
            className={`mt-3 rounded-2xl border px-4 py-2 text-sm ${
              feedback.tone === "success"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                : feedback.tone === "error"
                ? "border-rose-500/50 bg-rose-500/10 text-rose-100"
                : "border-slate-500/50 bg-slate-800/60 text-slate-100"
            }`}
          >
            {feedback.message}
          </p>
        ) : null}
      </div>

      {taskPhases.map((phase) => (
        <section key={phase.id} id={phase.id} className="space-y-6">
          <header className="space-y-2">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">{phase.highlight}</p>
            <h2 className="text-3xl font-semibold text-white">{phase.title}</h2>
            <p className="max-w-3xl text-base text-slate-300">{phase.description}</p>
          </header>

          <div className="grid gap-6 lg:grid-cols-2">
            {phase.tasks.map((task) => {
              const state = taskStates[task.id] ?? "idle";
              const commands = formatCommands(task.commands);
              const anchorTargets = task.resources
                ?.map((resource) => {
                  const hashIndex = resource.href.indexOf("#");
                  if (hashIndex === -1) {
                    return null;
                  }
                  const anchor = resource.href.slice(hashIndex + 1);
                  return anchor.length > 0 ? anchor : null;
                })
                .filter((anchor): anchor is string => Boolean(anchor)) ?? [];

              return (
                <article
                  key={task.id}
                  id={task.id}
                  className="flex h-full flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-950/60 p-6 shadow-[0_12px_45px_-30px_rgba(16,185,129,0.7)]"
                >
                  {anchorTargets.map((anchor) => (
                    <span key={anchor} id={anchor} aria-hidden="true" className="sr-only" />
                  ))}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold text-white">{task.title}</h3>
                      <p className="mt-1 text-sm text-slate-300">{task.summary}</p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        state === "done"
                          ? "bg-emerald-500/20 text-emerald-200"
                          : state === "in-progress"
                          ? "bg-amber-500/20 text-amber-200"
                          : "bg-slate-700/40 text-slate-300"
                      }`}
                    >
                      {state === "done" ? "Completed" : state === "in-progress" ? "In progress" : "Not started"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => startTask(task)}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
                    >
                      ▶️ Start Task
                    </button>
                    {state === "in-progress" ? (
                      <button
                        type="button"
                        onClick={() => completeTask(task.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
                      >
                        ✅ Mark complete
                      </button>
                    ) : null}
                    {state === "done" ? (
                      <button
                        type="button"
                        onClick={() => resetTask(task.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-200"
                      >
                        ↺ Restart
                      </button>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-emerald-200">Checklist</h4>
                    <ol className="list-decimal space-y-1 pl-4 text-sm text-slate-200">
                      {task.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>

                  {commands ? (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-emerald-200">Command queue</h4>
                      <pre className="overflow-x-auto rounded-2xl border border-slate-700 bg-slate-900/70 p-4 text-xs text-emerald-100">
                        <code>{commands}</code>
                      </pre>
                    </div>
                  ) : null}

                  {task.resources && task.resources.length > 0 ? (
                    <div className="space-y-1 text-sm text-emerald-200">
                      <h4 className="text-sm font-semibold text-emerald-200">Resources</h4>
                      <ul className="space-y-1">
                        {task.resources.map((resource) => (
                          <li key={resource.href}>
                            <Link
                              href={resource.href}
                              className="inline-flex items-center gap-2 text-emerald-200 underline-offset-4 transition hover:text-emerald-100 hover:underline"
                            >
                              {resource.label}
                              <span aria-hidden>↗</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
