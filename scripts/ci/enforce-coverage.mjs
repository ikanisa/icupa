#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const threshold = Number.parseFloat(process.env.COVERAGE_THRESHOLD ?? "80");

if (Number.isNaN(threshold)) {
  console.error("[coverage] COVERAGE_THRESHOLD must be a number if set.");
  process.exit(1);
}

async function main() {
  const summaryPath = process.env.COVERAGE_SUMMARY ?? "coverage/coverage-summary.json";

  let raw;
  try {
    raw = await readFile(summaryPath, "utf8");
  } catch (error) {
    console.error(`[coverage] Unable to read summary at ${summaryPath}`);
    console.error(error);
    process.exit(1);
  }

  let summary;
  try {
    summary = JSON.parse(raw);
  } catch (error) {
    console.error("[coverage] Failed to parse coverage summary JSON.");
    console.error(error);
    process.exit(1);
  }

  const linesPct = Number.parseFloat(summary?.total?.lines?.pct ?? "NaN");

  if (!Number.isFinite(linesPct)) {
    console.error("[coverage] Missing line coverage percentage in summary.");
    process.exit(1);
  }

  const formatted = linesPct.toFixed(2);
  console.log(`[coverage] Lines: ${formatted}% (threshold ${threshold}%)`);

  if (linesPct + Number.EPSILON < threshold) {
    console.error(
      `[coverage] Coverage requirement not met: ${formatted}% < ${threshold}%\nAdd or expand tests before merging.`,
    );
    process.exit(1);
  }
}

await main();
