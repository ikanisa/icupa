import { getSupabaseServiceConfig } from "./env.ts";

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } =
  getSupabaseServiceConfig({ feature: "finance" });

type LedgerEntryType =
  | "intent_created"
  | "intent_failed"
  | "capture_succeeded"
  | "capture_failed"
  | "refund_requested"
  | "refund_succeeded"
  | "refund_failed";

interface AppendLedgerParams {
  entry_type: LedgerEntryType;
  amount_cents: number;
  currency: string;
  payment_id?: string;
  itinerary_id?: string;
  provider_ref?: string;
  note?: string;
  requestId?: string;
}

export async function appendLedgerEntry(params: AppendLedgerParams) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/fin-ledger-append`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
        "x-request-id": params.requestId ?? crypto.randomUUID(),
      },
      body: JSON.stringify({
        entry_type: params.entry_type,
        amount_cents: params.amount_cents,
        currency: params.currency,
        payment_id: params.payment_id,
        itinerary_id: params.itinerary_id,
        provider_ref: params.provider_ref,
        note: params.note,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`fin-ledger-append failed: ${text || response.statusText}`);
  }

  return await response.json() as { ok: boolean; ledger_id?: string | null };
}
