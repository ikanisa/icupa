#!/usr/bin/env node
/**
 * Eval CI script
 * Runs evaluations in CI environment
 */
import { join } from "path";
import { runEvals, calculatePassRate, printEvalSummary } from "../ai/evals/runner";
import { respond } from "../ai/responses/router";

async function main() {
  console.log("Starting AI agent evaluations...\n");

  const evalsDir = join(process.cwd(), "ai", "evals", "golden");
  const evalFiles = [
    join(evalsDir, "whatsapp_voucher.jsonl"),
    join(evalsDir, "voice_voucher.jsonl"),
    join(evalsDir, "realestate_booking.jsonl"),
  ];

  let allPassed = true;

  for (const file of evalFiles) {
    console.log(`\n=== Running: ${file} ===`);

    try {
      const results = await runEvals(file, respond);
      printEvalSummary(results);

      const passRate = calculatePassRate(results);
      if (passRate < 0.95) {
        console.error(`\nFAIL: Pass rate ${(passRate * 100).toFixed(2)}% below threshold 95%`);
        allPassed = false;
      } else {
        console.log(`\nPASS: Pass rate ${(passRate * 100).toFixed(2)}%`);
      }
    } catch (error) {
      console.error(`\nERROR running ${file}:`, error);
      allPassed = false;
    }
  }

  console.log("\n=== Final Result ===");
  if (allPassed) {
    console.log("✓ All evaluations passed");
    process.exit(0);
  } else {
    console.log("✗ Some evaluations failed");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
