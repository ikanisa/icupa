import { RESPONSES_MODEL, responsesClient } from "./client";
import { toolSchemas } from "../schemas";
import { callTool } from "../tooling/callTool";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ToolDef = {
  name: string;
  description: string;
  schema: any;
};

// Tool definitions for OpenAI Responses API
export const tools: ToolDef[] = [
  {
    name: "create_voucher",
    description:
      "Create and persist a new voucher for a customer with specified amount and currency",
    schema: toolSchemas.create_voucher,
  },
  {
    name: "lookup_customer",
    description: "Find customer information by their MSISDN (phone number)",
    schema: toolSchemas.lookup_customer,
  },
  {
    name: "redeem_voucher",
    description: "Redeem an issued voucher by voucher ID",
    schema: toolSchemas.redeem_voucher,
  },
  {
    name: "void_voucher",
    description: "Void an issued voucher by voucher ID (cannot void redeemed vouchers)",
    schema: toolSchemas.void_voucher,
  },
];

/**
 * Main response handler for OpenAI Responses API
 * Handles tool calls in a loop until completion
 */
export async function respond(input: Message[]): Promise<any> {
  const toolSpecs = tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.schema,
    },
  }));

  const messages: any[] = [...input];
  const MAX_TOOL_ITERATIONS = 6;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await responsesClient.chat.completions.create({
      model: RESPONSES_MODEL,
      messages,
      tools: toolSpecs,
    });

    const choice = response.choices?.[0];
    const assistantMessage = choice?.message;

    if (!assistantMessage) {
      return response;
    }

    const toolCalls = assistantMessage.tool_calls ?? [];

    if (toolCalls.length === 0) {
      return response;
    }

    messages.push(assistantMessage);

    const toolMessages = [] as any[];
    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      let args: Record<string, unknown> = {};

      try {
        args = JSON.parse(toolCall.function.arguments || "{}");
      } catch (error) {
        throw new Error(
          `Failed to parse tool arguments for ${toolName}: ${error}`
        );
      }

      const result = await callTool(toolName, args);
      toolMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content:
          typeof result === "string" ? result : JSON.stringify(result ?? {}),
      });
    }

    messages.push(...toolMessages);
  }

  throw new Error(
    `Exceeded maximum tool iterations (${MAX_TOOL_ITERATIONS}) without completing response.`
  );
}

/**
 * Extract text response from API result
 */
export function extractTextResponse(result: any): string {
  return result.choices?.[0]?.message?.content || "No response generated";
}
