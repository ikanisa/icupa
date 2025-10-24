#!/usr/bin/env node
import { spawn } from "node:child_process";

if (!process.env.SKIP_ENV_VALIDATION) {
  process.env.SKIP_ENV_VALIDATION = "true";
}

const args = ["build"];

if (process.env.USE_TURBOPACK === "true") {
  args.push("--turbopack");
}

const child = spawn("next", args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
