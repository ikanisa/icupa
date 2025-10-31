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

  // Make initial request to OpenAI
  const res = await responsesClient.chat.completions.create({
    model: RESPONSES_MODEL,
    messages: input,
    tools: toolSpecs,
  });

  // Handle tool calls if present
  const firstChoice = res.choices[0];
  if (firstChoice?.message?.tool_calls && firstChoice.message.tool_calls.length > 0) {
    const toolCalls = firstChoice.message.tool_calls;
    const toolMessages: any[] = [];

    // Execute each tool call
    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments || "{}");

      const result = await callTool(toolName, args);
      toolMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }

    // Create follow-up request with tool results
    const followUpMessages = [
      ...input,
      firstChoice.message,
      ...toolMessages,
    ];

    const followUp = await responsesClient.chat.completions.create({
      model: RESPONSES_MODEL,
      messages: followUpMessages,
      tools: toolSpecs,
    });

    return followUp;
  }

  return res;
}

/**
 * Extract text response from API result
 */
export function extractTextResponse(result: any): string {
  return result.choices?.[0]?.message?.content || "No response generated";
}
