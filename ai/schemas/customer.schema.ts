import { z } from "zod";

export const LookupCustomerInput = z.object({
  msisdn: z.string().min(10),
});
export type TLookupCustomerInput = z.infer<typeof LookupCustomerInput>;

export const LookupCustomerOutput = z.object({
  exists: z.boolean(),
  name: z.string().optional(),
  msisdn: z.string(),
});
export type TLookupCustomerOutput = z.infer<typeof LookupCustomerOutput>;
