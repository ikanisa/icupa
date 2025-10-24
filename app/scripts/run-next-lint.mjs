#!/usr/bin/env node
import { spawn } from "node:child_process";

if (!process.env.SKIP_ENV_VALIDATION) {
  process.env.SKIP_ENV_VALIDATION = "true";
}

const child = spawn("next", ["lint"], {
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
