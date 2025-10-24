#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.SKIP_ENV_VALIDATION) {
  process.env.SKIP_ENV_VALIDATION = "true";
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceNodeModules = path.resolve(__dirname, "../node_modules");
const rootNodeModules = path.resolve(__dirname, "../../node_modules");

const nodePathEntries = [workspaceNodeModules, rootNodeModules, process.env.NODE_PATH]
  .filter(Boolean)
  .flatMap((value) => value.split(path.delimiter).filter(Boolean));

process.env.NODE_PATH = [...new Set(nodePathEntries)].join(path.delimiter);

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
