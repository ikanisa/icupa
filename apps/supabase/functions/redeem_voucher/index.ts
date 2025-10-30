import { createClient } from "@supabase/supabase-js";
import type {
  TVoucherRedeemInput,
  TVoucherRedeemOutput,
} from "../../../ai/schemas";

export async function redeemVoucher(
  input: TVoucherRedeemInput
): Promise<TVoucherRedeemOutput> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check if voucher exists and is in issued state
  const { data: existing, error: fetchError } = await supabase
    .from("vouchers")
    .select("*")
    .eq("id", input.voucher_id)
    .single();

  if (fetchError || !existing) {
    throw new Error("Voucher not found");
  }

  if (existing.status !== "issued") {
    throw new Error(`Voucher cannot be redeemed (current status: ${existing.status})`);
  }

  // Update voucher status to redeemed
  const { data, error } = await supabase
    .from("vouchers")
    .update({ status: "redeemed", redeemed_at: new Date().toISOString() })
    .eq("id", input.voucher_id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    voucher_id: data.id,
    status: data.status,
    amount: data.amount,
    currency: data.currency,
  };
}
