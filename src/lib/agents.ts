import { z } from "zod";

type CartItemPayload = {
  item_id: string;
  quantity: number;
};

const UpsellSuggestionSchema = z.object({
  item_id: z.string(),
  name: z.string(),
  price_cents: z.number(),
  currency: z.string(),
  rationale: z.string(),
  allergens: z.array(z.string()),
  tags: z.array(z.string()),
  is_alcohol: z.boolean(),
  citations: z.array(z.string()),
  impression_id: z.string().optional()
});

const WaiterResponseSchema = z.object({
  session_id: z.string(),
  reply: z.string(),
  upsell: z.array(UpsellSuggestionSchema).default([]),
  disclaimers: z.array(z.string()).default([]),
  citations: z.array(z.string()),
  cost_usd: z.number().optional()
});

export type WaiterResponse = z.infer<typeof WaiterResponseSchema>;
export type UpsellSuggestion = z.infer<typeof UpsellSuggestionSchema>;

export interface WaiterRequest {
  message: string;
  session_id?: string | null;
  table_session_id?: string | null;
  location_id?: string | null;
  tenant_id?: string | null;
  language?: string | null;
  allergies?: string[];
  cart?: CartItemPayload[];
  age_verified?: boolean;
}

function normaliseUrl(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function buildError(message: string, status?: number) {
  const error = new Error(message);
  if (typeof status === "number") {
    (error as Error & { status?: number }).status = status;
  }
  return error;
}

export async function callWaiterAgent(payload: WaiterRequest): Promise<WaiterResponse> {
  const baseUrl = import.meta.env.VITE_AGENTS_SERVICE_URL?.trim();
  if (!baseUrl) {
    throw new Error("Agents service URL is not configured. Set VITE_AGENTS_SERVICE_URL in your environment.");
  }

  const target = `${normaliseUrl(baseUrl)}/agents/waiter`;
  const response = await fetch(target, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      message: payload.message,
      session_id: payload.session_id ?? undefined,
      table_session_id: payload.table_session_id ?? undefined,
      location_id: payload.location_id ?? undefined,
      tenant_id: payload.tenant_id ?? undefined,
      language: payload.language ?? undefined,
      allergies: payload.allergies ?? undefined,
      cart: payload.cart ?? undefined,
      age_verified: payload.age_verified ?? undefined
    })
  });

  if (!response.ok) {
    let detail = `Agent request failed with status ${response.status}`;
    try {
      const data = await response.json();
      if (typeof data?.message === "string") {
        detail = data.message;
      } else if (typeof data?.error === "string") {
        detail = data.error;
      }
    } catch (err) {
      // ignore parsing error
    }
    throw buildError(detail, response.status);
  }

  const json = await response.json();
  return WaiterResponseSchema.parse(json);
}

export function cartToAgentPayload(cart: { id: string; quantity: number }[]): CartItemPayload[] {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return cart
    .filter((item) => uuidPattern.test(item.id) && item.quantity > 0)
    .map((item) => ({ item_id: item.id, quantity: item.quantity }));
}
