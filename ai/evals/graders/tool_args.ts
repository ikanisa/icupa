/**
 * Tool arguments grader
 * Validates that tool calls have correct arguments
 */

interface ToolCall {
  name: string;
  arguments: any;
}

interface Expected {
  expected_tools?: string[];
  expected_args?: any;
}

/**
 * Grade tool arguments accuracy
 * Returns score between 0 and 1
 */
export function gradeToolArgs(
  actualToolCalls: ToolCall[],
  expected: Expected
): number {
  if (!expected.expected_tools || expected.expected_tools.length === 0) {
    return actualToolCalls.length === 0 ? 1 : 0; // No tools expected, pass only if none called
  }

  // Check if expected tools were called
  const actualToolNames = actualToolCalls.map((t) => t.name);
  const toolsMatch = expected.expected_tools.every((tool) =>
    actualToolNames.includes(tool)
  );

  if (!toolsMatch) {
    return 0; // Wrong tools called
  }

  // Check if arguments match expected
  if (expected.expected_args) {
    const toolCall = actualToolCalls.find((t) =>
      expected.expected_tools?.includes(t.name)
    );
    if (!toolCall) return 0;

    // Calculate argument accuracy
    const expectedKeys = Object.keys(expected.expected_args);
    const matchingKeys = expectedKeys.filter((key) => {
      const expectedValue = expected.expected_args[key];
      const actualValue = toolCall.arguments[key];
      // Flexible comparison
      return String(expectedValue) === String(actualValue);
    });

    return matchingKeys.length / expectedKeys.length;
  }

  return 1; // Tools match and no specific args to check
}

/**
 * Check if tool arguments are valid (basic validation)
 */
export function validateToolArgs(toolCall: ToolCall): boolean {
  // Basic validation - ensure arguments is an object
  if (typeof toolCall.arguments !== "object" || toolCall.arguments === null) {
    return false;
  }

  // Tool-specific validation
  switch (toolCall.name) {
    case "create_voucher":
      return (
        typeof toolCall.arguments.customer_msisdn === "string" &&
        typeof toolCall.arguments.amount === "number" &&
        toolCall.arguments.amount > 0
      );
    case "lookup_customer":
      return typeof toolCall.arguments.msisdn === "string";
    case "redeem_voucher":
    case "void_voucher":
      return typeof toolCall.arguments.voucher_id === "string";
    default:
      return true; // Unknown tool, assume valid
  }
}
