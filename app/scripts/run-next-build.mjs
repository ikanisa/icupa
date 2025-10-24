#!/usr/bin/env node
import { spawn } from "node:child_process";

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });

    child.on("close", (code) => {
      resolve(code ?? 0);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);

  const turbopackArgs = ["build", ...args, "--turbopack"];
  const turbopackResult = await run("next", turbopackArgs, { env: process.env });

  if (turbopackResult === 0) {
    return;
  }

  console.warn(
    "[build] Turbopack build failed (exit code %d). Falling back to the webpack compiler...",
    turbopackResult,
  );

  const fallbackArgs = ["build", ...args.filter((arg) => arg !== "--turbopack")];
  const fallbackResult = await run("next", fallbackArgs, { env: process.env });

  if (fallbackResult !== 0) {
    process.exit(fallbackResult);
  }
}

main().catch((error) => {
  console.error("[build] Unexpected error while running Next.js build.", error);
  process.exit(1);
});
