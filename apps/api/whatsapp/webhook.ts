/**
 * WhatsApp webhook handler
 * Receives incoming messages and verification challenges from WhatsApp Cloud API
 */
import { respond, extractTextResponse } from "../../../ai/responses/router";
import { WHATSAPP_SYSTEM_PROMPT } from "../../../ai/responses/prompts";

// Simple in-memory cache for idempotency (in production, use Redis or database)
const processedMessages = new Set<string>();

/**
 * Verify webhook token (GET request)
 */
function verifyWebhook(query: any): { challenge?: string; error?: string } {
  const token = process.env.WA_VERIFY_TOKEN!;
  const mode = query["hub.mode"];
  const challenge = query["hub.challenge"];
  const verifyToken = query["hub.verify_token"];

  if (mode === "subscribe" && verifyToken === token) {
    return { challenge };
  }

  return { error: "Verification failed" };
}

/**
 * Send WhatsApp message
 */
async function sendWhatsapp(to: string, text: string): Promise<void> {
  const url = `${process.env.WA_API_BASE}/${process.env.WA_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `WhatsApp API error: ${response.status} ${await response.text()}`
    );
  }
}

/**
 * Process incoming WhatsApp message
 */
async function processMessage(message: any): Promise<void> {
  const messageId = message.id;
  const text = message.text?.body ?? "";
  const from = message.from;

  // Idempotency check
  if (processedMessages.has(messageId)) {
    console.log(`Skipping duplicate message: ${messageId}`);
    return;
  }

  // Mark as processed
  processedMessages.add(messageId);

  // Clean up old messages (keep last 1000)
  if (processedMessages.size > 1000) {
    const firstKey = processedMessages.values().next().value;
    processedMessages.delete(firstKey);
  }

  try {
    // Build input for AI
    const input = [
      { role: "system" as const, content: WHATSAPP_SYSTEM_PROMPT },
      { role: "user" as const, content: text },
    ];

    // Get AI response
    const response = await respond(input);
    const reply = extractTextResponse(response);

    // Send reply
    await sendWhatsapp(from, reply);
  } catch (error) {
    console.error(`Error processing message ${messageId}:`, error);
    // Send error message to user
    await sendWhatsapp(
      from,
      "Sorry, I encountered an error processing your request. Please try again."
    );
  }
}

/**
 * Main webhook handler
 * This would be integrated into your API framework (Express, Fastify, etc.)
 */
export async function handleWebhook(
  method: string,
  query: any,
  body: any
): Promise<{ status: number; body: any }> {
  // GET: Webhook verification
  if (method === "GET") {
    const result = verifyWebhook(query);
    if (result.challenge) {
      return { status: 200, body: result.challenge };
    }
    return { status: 403, body: { error: result.error } };
  }

  // POST: Incoming messages
  if (method === "POST") {
    const payload = body;
    const messages = payload.entry?.[0]?.changes?.[0]?.value?.messages ?? [];

    // Process messages in parallel
    await Promise.all(messages.map(processMessage));

    return { status: 200, body: { received: true } };
  }

  return { status: 405, body: { error: "Method not allowed" } };
}

// Export individual functions for testing
export { verifyWebhook, sendWhatsapp, processMessage };
