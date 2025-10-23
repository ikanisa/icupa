#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  checkSupabaseAnonEnv,
  checkSupabasePublicEnv,
  checkSupabaseServiceEnv,
} from "@ecotrips/config/env";

const REQUIRED_NODE_MAJOR = 18;

const projects = [
  {
    name: "marketing",
    cwd: "app",
    checkEnv: () => checkSupabaseServiceEnv(),
    optionalEnv: ["PLAYWRIGHT_BASE_URL"],
    buildCommand: "npm run build",
  },
  {
    name: "client",
    cwd: "apps/client",
    checkEnv: () => checkSupabasePublicEnv(),
    optionalEnv: ["VERCEL_AUTOMATION_BYPASS_SECRET"],
    buildCommand: "npm run build",
  },
  {
    name: "admin",
    cwd: "apps/admin",
    checkEnv: () => checkSupabasePublicEnv(),
    optionalEnv: ["VERCEL_AUTOMATION_BYPASS_SECRET"],
    buildCommand: "npm run build",
  },
  {
    name: "ops-console",
    cwd: "ops/console",
    checkEnv: () => checkSupabaseAnonEnv(),
    optionalEnv: [
      "OPS_CONSOLE_BYPASS_AUTH",
      "OPSCONSOLE_BYPASS_AUTH",
      "OPSCONSOLE_OFFLINE_MODE",
    ],
    buildCommand: "npm run build",
  },
];

const run = (command, options = {}) => {
  execSync(command, { stdio: "inherit", ...options });
};

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
if (Number.isNaN(nodeMajor) || nodeMajor !== REQUIRED_NODE_MAJOR) {
  console.error(
    `[ENV] Expected Node ${REQUIRED_NODE_MAJOR}.x but found ${process.version}. Use nvm or Volta to switch.`,
  );
  process.exit(1);
}

console.log(`[ENV] Node version OK (${process.version}).`);

try {
  run("npm --version");
} catch (error) {
  console.error("[ENV] npm is required to install dependencies.");
  process.exit(1);
}

try {
  run("npx vercel --version", { stdio: "pipe" });
  console.log("[ENV] Vercel CLI available.");
} catch (error) {
  console.warn("[ENV] Install Vercel CLI (npm i -g vercel) to run pull/build locally.");
}

let failed = false;

const formatIssuePath = (issue) => issue.path.join(".") || issue.path[0] || "";

for (const project of projects) {
  console.log(`\n[CHECK] ${project.name} (${project.cwd})`);
  if (project.checkEnv) {
    const result = project.checkEnv();
    if (!result.ok) {
      if (result.missing.length > 0) {
        console.error(
          `[ENV] Missing required variables for ${project.name}: ${result.missing.join(", ")}`,
        );
      }
      for (const issue of result.issues) {
        console.error(`[ENV] ${formatIssuePath(issue)}: ${issue.message}`);
      }
      failed = true;
      continue;
    }

    console.log(`[ENV] ${project.name} environment looks good.`);
  }

  const vercelProjectFile = path.join(project.cwd, ".vercel", "project.json");
  if (!existsSync(vercelProjectFile)) {
    console.warn(
      `[WARN] ${project.name} is not linked to a Vercel project. Run \`vercel link\` inside ${project.cwd}.`,
    );
  }

  if (project.optionalEnv?.length) {
    const missingOptional = project.optionalEnv.filter((key) => !process.env[key]);
    if (missingOptional.length > 0) {
      console.log(
        `[INFO] Optional variables for ${project.name} not set: ${missingOptional.join(", ")}`,
      );
    }
  }

  try {
    run(project.buildCommand, { cwd: project.cwd });
    console.log(`[PASS] ${project.name} build succeeded.`);
  } catch (error) {
    console.error(`[FAIL] ${project.name} build failed.`);
    failed = true;
  }
}

if (failed) {
  console.error("\nPreflight FAILED. Review errors above and retry.");
  process.exit(1);
}

console.log("\nPreflight PASS. All builds completed successfully.");
