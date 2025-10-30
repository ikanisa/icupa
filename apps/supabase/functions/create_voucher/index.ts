import { createClient } from "@supabase/supabase-js";
import type {
  TVoucherCreateInput,
  TVoucherCreateOutput,
} from "../../../ai/schemas";

export async function createVoucher(
  input: TVoucherCreateInput
): Promise<TVoucherCreateOutput> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("vouchers")
    .insert({
      customer_msisdn: input.customer_msisdn,
      amount: input.amount,
      currency: input.currency || "RWF",
      status: "issued",
    })
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
