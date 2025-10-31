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

  const conversation: any[] = [...input];
  let iteration = 0;
  const MAX_TOOL_ITERATIONS = 8;

  while (iteration < MAX_TOOL_ITERATIONS) {
    const response = await responsesClient.chat.completions.create({
      model: RESPONSES_MODEL,
      messages: conversation,
      tools: toolSpecs,
    });

    const choice = response.choices[0];
    const assistantMessage = choice?.message;

    if (!assistantMessage) {
      return response;
    }

    conversation.push(assistantMessage);

    const toolCalls = assistantMessage.tool_calls || [];
    if (toolCalls.length === 0) {
      return response;
    }

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments || "{}");
      const result = await callTool(toolName, args);

      conversation.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content:
          typeof result === "string" ? result : JSON.stringify(result ?? {}),
      });
    }

    iteration += 1;
  }

  throw new Error(
    `Exceeded maximum tool call iterations (${MAX_TOOL_ITERATIONS}) without completion`
  );
}

/**
 * Extract text response from API result
 */
export function extractTextResponse(result: any): string {
  return result.choices?.[0]?.message?.content || "No response generated";
}
