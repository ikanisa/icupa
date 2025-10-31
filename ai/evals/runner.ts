/**
 * Eval runner
 * Runs golden conversations through the agent and grades responses
 */
import { readFileSync } from "fs";
import { join } from "path";
import { gradeToolArgs } from "./graders/tool_args";
import { gradeHallucination } from "./graders/hallucination";
import { gradePIILeak } from "./graders/pii_leak";

interface EvalCase {
  user: string;
  expected_tools?: string[];
  expected_args?: any;
  expected_response_contains?: string;
}

interface EvalResult {
  case: EvalCase;
  passed: boolean;
  scores: {
    toolArgs: number;
    hallucination: number;
    piiLeak: number;
    overall: number;
  };
  details?: any;
}

/**
 * Load eval cases from JSONL file
 */
export function loadEvalCases(filePath: string): EvalCase[] {
  const content = readFileSync(filePath, "utf-8");
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

/**
 * Run a single eval case
 */
export async function runEvalCase(
  evalCase: EvalCase,
  respondFunc: (input: any[]) => Promise<any>
): Promise<EvalResult> {
  try {
    // Build input
    const input = [
      { role: "system" as const, content: "You are a helpful agent." },
      { role: "user" as const, content: evalCase.user },
    ];

    // Get response
    const response = await respondFunc(input);

    // Extract tool calls and response text
    const toolCalls = extractToolCalls(response);
    const responseText = extractResponseText(response);

    // Grade with each grader
    const toolArgsScore = gradeToolArgs(toolCalls, {
      expected_tools: evalCase.expected_tools,
      expected_args: evalCase.expected_args,
    });

    const hallucinationScore = gradeHallucination(responseText, input);
    const piiLeakScore = gradePIILeak(responseText);

    // Calculate overall score (weighted average)
    const overall = toolArgsScore * 0.4 + hallucinationScore * 0.3 + piiLeakScore * 0.3;

    return {
      case: evalCase,
      passed: overall >= 0.95,
      scores: {
        toolArgs: toolArgsScore,
        hallucination: hallucinationScore,
        piiLeak: piiLeakScore,
        overall,
      },
      details: {
        toolCalls,
        responseText,
      },
    };
  } catch (error) {
    return {
      case: evalCase,
      passed: false,
      scores: {
        toolArgs: 0,
        hallucination: 0,
        piiLeak: 0,
        overall: 0,
      },
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Run all eval cases from a file
 */
export async function runEvals(
  filePath: string,
  respondFunc: (input: any[]) => Promise<any>
): Promise<EvalResult[]> {
  const cases = loadEvalCases(filePath);
  const results: EvalResult[] = [];

  for (const evalCase of cases) {
    const result = await runEvalCase(evalCase, respondFunc);
    results.push(result);
  }

  return results;
}

/**
 * Extract tool calls from response
 */
function extractToolCalls(response: any): any[] {
  try {
    const message = response.choices?.[0]?.message;
    if (message?.tool_calls) {
      return message.tool_calls.map((tc: any) => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments || "{}"),
      }));
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Extract response text
 */
function extractResponseText(response: any): string {
  return response.choices?.[0]?.message?.content || "";
}

/**
 * Calculate pass rate
 */
export function calculatePassRate(results: EvalResult[]): number {
  if (results.length === 0) return 0;
  const passed = results.filter((r) => r.passed).length;
  return passed / results.length;
}

/**
 * Print eval summary
 */
export function printEvalSummary(results: EvalResult[]): void {
  console.log("\n=== Eval Summary ===");
  console.log(`Total cases: ${results.length}`);
  console.log(`Passed: ${results.filter((r) => r.passed).length}`);
  console.log(`Failed: ${results.filter((r) => !r.passed).length}`);
  console.log(`Pass rate: ${(calculatePassRate(results) * 100).toFixed(2)}%`);

  // Average scores
  const avgToolArgs =
    results.reduce((sum, r) => sum + r.scores.toolArgs, 0) / results.length;
  const avgHallucination =
    results.reduce((sum, r) => sum + r.scores.hallucination, 0) / results.length;
  const avgPII = results.reduce((sum, r) => sum + r.scores.piiLeak, 0) / results.length;

  console.log("\n=== Average Scores ===");
  console.log(`Tool Args: ${(avgToolArgs * 100).toFixed(2)}%`);
  console.log(`Hallucination: ${(avgHallucination * 100).toFixed(2)}%`);
  console.log(`PII Leak: ${(avgPII * 100).toFixed(2)}%`);

  // Failed cases
  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.log("\n=== Failed Cases ===");
    failed.forEach((r, i) => {
      console.log(`\n${i + 1}. ${r.case.user}`);
      console.log(`   Overall: ${(r.scores.overall * 100).toFixed(2)}%`);
      console.log(`   Tool Args: ${(r.scores.toolArgs * 100).toFixed(2)}%`);
      console.log(`   Hallucination: ${(r.scores.hallucination * 100).toFixed(2)}%`);
      console.log(`   PII Leak: ${(r.scores.piiLeak * 100).toFixed(2)}%`);
      if (r.details?.error) {
        console.log(`   Error: ${r.details.error}`);
      }
    });
  }
}
