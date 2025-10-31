import { createClient } from "@supabase/supabase-js";
import type { TVoucherVoidInput, TVoucherVoidOutput } from "../../../ai/schemas";

export async function voidVoucher(
  input: TVoucherVoidInput
): Promise<TVoucherVoidOutput> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check if voucher exists
  const { data: existing, error: fetchError } = await supabase
    .from("vouchers")
    .select("*")
    .eq("id", input.voucher_id)
    .single();

  if (fetchError || !existing) {
    throw new Error("Voucher not found");
  }

  if (existing.status === "redeemed") {
    throw new Error("Cannot void a redeemed voucher");
  }

  // Update voucher status to void
  const { data, error } = await supabase
    .from("vouchers")
    .update({ status: "void", voided_at: new Date().toISOString() })
    .eq("id", input.voucher_id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    voucher_id: data.id,
    status: data.status,
  };
}
