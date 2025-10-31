import { createClient } from "@supabase/supabase-js";
import type { TLookupCustomerInput, TLookupCustomerOutput } from "../../../ai/schemas";

export async function lookupCustomer(
  input: TLookupCustomerInput
): Promise<TLookupCustomerOutput> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("customers")
    .select("msisdn,name")
    .eq("msisdn", input.msisdn)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    exists: !!data,
    name: data?.name,
    msisdn: input.msisdn,
  };
}
