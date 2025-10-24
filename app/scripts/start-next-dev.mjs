#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceNodeModules = path.resolve(__dirname, "../node_modules");
const rootNodeModules = path.resolve(__dirname, "../../node_modules");

const nodePathEntries = [workspaceNodeModules, rootNodeModules, process.env.NODE_PATH]
  .filter(Boolean)
  .flatMap((value) => value.split(path.delimiter).filter(Boolean));

process.env.NODE_PATH = [...new Set(nodePathEntries)].join(path.delimiter);
process.env.TURBOPACK = process.env.TURBOPACK ?? "0";
process.env.NEXT_DISABLE_TURBOPACK = process.env.NEXT_DISABLE_TURBOPACK ?? "1";
process.env.SKIP_ENV_VALIDATION = process.env.SKIP_ENV_VALIDATION ?? "true";

const child = spawn("next", ["dev"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
