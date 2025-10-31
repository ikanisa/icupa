/**
 * Hallucination grader
 * Detects when AI generates information not grounded in context
 */

interface Message {
  role: string;
  content: string;
}

/**
 * Grade for hallucinations
 * Returns score between 0 (hallucinating) and 1 (grounded)
 */
export function gradeHallucination(
  response: string,
  context: Message[],
  groundTruth?: string
): number {
  const lowerResponse = response.toLowerCase();

  // Check for common hallucination patterns
  const hallucinationPatterns = [
    /according to (my|our) (database|records|system), (?!I|we)/i,
    /I (have|can) see that/i,
    /the (customer|voucher) (has|is)/i,
  ];

  // If response makes definitive claims without tool calls, it's likely hallucinating
  const hasClaims = hallucinationPatterns.some((pattern) =>
    pattern.test(response)
  );

  if (hasClaims) {
    // Check if there were actual tool calls in context
    const hasToolCalls = context.some(
      (msg) => msg.role === "tool" || msg.content.includes("tool_call")
    );
    if (!hasToolCalls) {
      return 0.3; // Likely hallucinating
    }
  }

  // Check for specific false information if ground truth provided
  if (groundTruth) {
    const similarity = calculateSimilarity(lowerResponse, groundTruth.toLowerCase());
    return similarity;
  }

  // Check for uncertainty phrases (good - agent is not hallucinating)
  const uncertaintyPhrases = [
    "let me check",
    "i'll look that up",
    "i need to verify",
    "i don't have that information",
  ];

  const hasUncertainty = uncertaintyPhrases.some((phrase) =>
    lowerResponse.includes(phrase)
  );

  if (hasUncertainty && !hasClaims) {
    return 1; // Good - agent is cautious
  }

  return 0.7; // Default - probably okay
}

/**
 * Simple similarity calculation
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Check if response contains specific false claims
 */
export function containsFalseClaims(response: string, facts: string[]): boolean {
  const lowerResponse = response.toLowerCase();
  return facts.some((fact) => !lowerResponse.includes(fact.toLowerCase()));
}
