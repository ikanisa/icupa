#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");

const scenarios = [
  {
    id: "whatsapp-pricing",
    label: "WhatsApp pricing rehearsal",
    async run() {
      const priceFixturePath = resolve(repoRoot, "ops", "fixtures", "price_breakdown.json");
      const priceFixture = JSON.parse(await readFile(priceFixturePath, "utf8"));
      const conciergeSegments = priceFixture.breakdowns
        .flatMap((breakdown) => breakdown.segments ?? [])
        .filter((segment) => /whatsapp/i.test(segment.description ?? ""));
      return {
        ok: conciergeSegments.length > 0,
        evidence: conciergeSegments.map((segment) => ({
          id: segment.id,
          label: segment.label,
          description: segment.description,
        })),
      };
    },
  },
  {
    id: "voice-fallback",
    label: "Voice fallback rehearsal",
    async run() {
      const voiceFixturePath = resolve(repoRoot, "ops", "fixtures", "voice_contact_thread.json");
      const voiceFixture = JSON.parse(await readFile(voiceFixturePath, "utf8"));
      const nextSteps = voiceFixture.summary?.next_steps ?? [];
      const includesFollowUp = nextSteps.some((step) => /whatsapp follow-up/i.test(step));
      const transcript = voiceFixture.transcript ?? [];
      return {
        ok: includesFollowUp && transcript.length >= 3,
        evidence: {
          nextSteps,
          transcriptSample: transcript.slice(0, 2),
        },
      };
    },
  },
  {
    id: "gdpr-logging",
    label: "GDPR logging rehearsal",
    async run() {
      const dataMapPath = resolve(repoRoot, "ops", "privacy", "DATAMAP.md");
      const dataMap = await readFile(dataMapPath, "utf8");
      const mentionsWhatsAppRedaction = /WhatsApp transcript payload \(redact body \+ WA identifiers\)/i.test(dataMap);
      const mentionsRetention = /Retention\s*\|/i.test(dataMap);
      return {
        ok: mentionsWhatsAppRedaction && mentionsRetention,
        evidence: {
          mentionsWhatsAppRedaction,
          mentionsRetention,
        },
      };
    },
  },
];

async function main() {
  console.log("=== Router-Agent Rehearsal Suite ===");
  const results = [];

  for (const scenario of scenarios) {
    try {
      const result = await scenario.run();
      const status = result.ok ? "PASS" : "FAIL";
      results.push({
        id: scenario.id,
        label: scenario.label,
        status,
        evidence: result.evidence,
      });
      console.log(`• ${scenario.label}: ${status}`);
      console.log(JSON.stringify(result.evidence, null, 2));
    } catch (error) {
      results.push({
        id: scenario.id,
        label: scenario.label,
        status: "ERROR",
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`• ${scenario.label}: ERROR`);
      console.error(error);
    }
    console.log("-");
  }

  const failed = results.some((result) => result.status !== "PASS");
  if (failed) {
    console.error("Rehearsal suite detected failures. See logs above for evidence.");
    process.exitCode = 1;
  } else {
    console.log("All router-agent rehearsals passed.");
  }
}

main().catch((error) => {
  console.error("Unexpected error while running router-agent rehearsals.", error);
  process.exit(1);
});

