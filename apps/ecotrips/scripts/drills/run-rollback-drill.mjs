#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");

async function checkBlueGreenPlaybook() {
  const path = resolve(repoRoot, "ops", "rollout", "BLUE_GREEN.md");
  const contents = await readFile(path, "utf8");
  const hasRollbackPlaybook = /"rollback_playbook"/i.test(contents);
  const hasRollbackStep = /\*\*Rollback\*\*/i.test(contents) || /Rollback/gi.test(contents);
  return {
    id: "blue-green-playbook",
    label: "Blue/Green rollout playbook",
    ok: hasRollbackPlaybook && hasRollbackStep,
    evidence: {
      hasRollbackPlaybook,
      hasRollbackStep,
    },
  };
}

async function checkProductionReadiness() {
  const path = resolve(repoRoot, "ops", "PRODUCTION_READINESS.md");
  const contents = await readFile(path, "utf8");
  const mentionsRollbackPlan = /A rollback plan is written/i.test(contents);
  const mentionsWhatsAppDrill = /WhatsApp drill/i.test(contents);
  return {
    id: "production-readiness",
    label: "Production readiness checklist",
    ok: mentionsRollbackPlan && mentionsWhatsAppDrill,
    evidence: {
      mentionsRollbackPlan,
      mentionsWhatsAppDrill,
    },
  };
}

async function checkIncidentResponse() {
  const path = resolve(repoRoot, "ops", "INCIDENT_RESPONSE.md");
  const contents = await readFile(path, "utf8");
  const referencesObservability = /test:observability/i.test(contents);
  const referencesRollback = /rollback/i.test(contents);
  return {
    id: "incident-response",
    label: "Incident response guide",
    ok: referencesObservability && referencesRollback,
    evidence: {
      referencesObservability,
      referencesRollback,
    },
  };
}

async function main() {
  console.log("=== Router-Agent Rollback Drill ===");
  const checks = await Promise.all([
    checkBlueGreenPlaybook(),
    checkProductionReadiness(),
    checkIncidentResponse(),
  ]);

  let failures = 0;
  for (const check of checks) {
    const status = check.ok ? "PASS" : "FAIL";
    console.log(`• ${check.label}: ${status}`);
    console.log(JSON.stringify(check.evidence, null, 2));
    console.log("-");
    if (!check.ok) {
      failures += 1;
    }
  }

  if (failures > 0) {
    console.error(`${failures} rollback criteria failed. Investigate before merging to main.`);
    process.exitCode = 1;
  } else {
    console.log("Rollback safeguards confirmed. Document evidence in the readiness report before merge.");
  }
}

main().catch((error) => {
  console.error("Unexpected error during rollback drill.", error);
  process.exit(1);
});

