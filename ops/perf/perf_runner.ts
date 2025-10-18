#!/usr/bin/env -S deno run -A
import { readTextFile } from "https://deno.land/std@0.220.1/fs/read_file_str.ts";

interface ScenarioStep {
  name: string;
  method: string;
  path: string;
  body?: unknown;
}

interface Scenario {
  description: string;
  steps: ScenarioStep[];
}

interface ScenarioMap {
  [key: string]: Scenario;
}

const SUPABASE_URL = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? "https://woyknezboamabahknmjr.supabase.co";
const ANON_KEY = Deno.env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? "anon-key-placeholder";

function parseArgs() {
  const scenarioFlagIndex = Deno.args.findIndex((arg) => arg === "--scenario");
  const scenario = scenarioFlagIndex >= 0 ? Deno.args[scenarioFlagIndex + 1] : "smoke";
  return { scenario };
}

async function loadScenarios(): Promise<ScenarioMap> {
  const raw = await readTextFile(new URL("./scenarios.json", import.meta.url));
  return JSON.parse(raw) as ScenarioMap;
}

async function runStep(step: ScenarioStep) {
  const url = `${SUPABASE_URL}${step.path}`;
  const init: RequestInit = {
    method: step.method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
  };
  if (step.body) {
    init.body = JSON.stringify(step.body);
  }

  const start = performance.now();
  let ok = true;
  let status = 0;
  let errorMessage = "";

  try {
    const response = await fetch(url, init);
    status = response.status;
    if (!response.ok) {
      ok = false;
      errorMessage = await response.text();
    } else {
      await response.text();
    }
  } catch (error) {
    ok = false;
    errorMessage = (error as Error).message;
  }
  const end = performance.now();

  return { name: step.name, duration: end - start, ok, status, errorMessage };
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

async function main() {
  const { scenario } = parseArgs();
  const scenarios = await loadScenarios();
  const config = scenarios[scenario];
  if (!config) {
    console.error(`Unknown scenario: ${scenario}`);
    Deno.exit(1);
  }

  console.log(`Running perf scenario: ${scenario} — ${config.description}`);
  const results = [];
  for (const step of config.steps) {
    const outcome = await runStep(step);
    results.push(outcome);
    console.log(`  • ${step.name} ${outcome.ok ? "✅" : "❌"} ${outcome.duration.toFixed(1)}ms (status ${outcome.status})`);
    if (!outcome.ok) {
      console.error(`    ↳ error: ${outcome.errorMessage}`);
    }
  }

  const durations = results.map((r) => r.duration);
  const p95 = percentile(durations, 95);
  const errors = results.filter((r) => !r.ok).length;

  console.log(`Summary: p95=${p95.toFixed(1)}ms, errors=${errors}`);
  if (p95 > 800) {
    console.error("p95 exceeds 800ms budget");
    Deno.exit(1);
  }
  if (errors > 1) {
    console.error("Error count exceeds budget (1)");
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
