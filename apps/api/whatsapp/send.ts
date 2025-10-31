/**
 * WhatsApp message sender utility
 * Provides functions to send various types of WhatsApp messages
 */

const WA_API_BASE = process.env.WA_API_BASE || "https://graph.facebook.com/v19.0";
const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID!;
const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN!;

/**
 * Send a text message via WhatsApp
 */
export async function sendTextMessage(
  to: string,
  text: string
): Promise<{ messageId: string }> {
  const url = `${WA_API_BASE}/${WA_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
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
    const errorText = await response.text();
    throw new Error(`WhatsApp API error: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  return { messageId: result.messages?.[0]?.id };
}

/**
 * Send a template message via WhatsApp
 */
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string = "en",
  components?: any[]
): Promise<{ messageId: string }> {
  const url = `${WA_API_BASE}/${WA_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components: components || [],
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WhatsApp API error: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  return { messageId: result.messages?.[0]?.id };
}

/**
 * Mark a message as read
 */
export async function markAsRead(messageId: string): Promise<void> {
  const url = `${WA_API_BASE}/${WA_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WhatsApp API error: ${response.status} ${errorText}`);
  }
}
