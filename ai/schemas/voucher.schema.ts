import { z } from "zod";

export const VoucherCreateInput = z.object({
  customer_msisdn: z.string().min(10),
  amount: z.number().positive(),
  currency: z.string().default("RWF"),
});
export type TVoucherCreateInput = z.infer<typeof VoucherCreateInput>;

export const VoucherCreateOutput = z.object({
  voucher_id: z.string().uuid(),
  status: z.enum(["issued", "redeemed", "void"]).default("issued"),
  amount: z.number(),
  currency: z.string(),
});
export type TVoucherCreateOutput = z.infer<typeof VoucherCreateOutput>;

export const VoucherRedeemInput = z.object({
  voucher_id: z.string().uuid(),
});
export type TVoucherRedeemInput = z.infer<typeof VoucherRedeemInput>;

export const VoucherRedeemOutput = z.object({
  voucher_id: z.string().uuid(),
  status: z.enum(["issued", "redeemed", "void"]),
  amount: z.number(),
  currency: z.string(),
});
export type TVoucherRedeemOutput = z.infer<typeof VoucherRedeemOutput>;

export const VoucherVoidInput = z.object({
  voucher_id: z.string().uuid(),
});
export type TVoucherVoidInput = z.infer<typeof VoucherVoidInput>;

export const VoucherVoidOutput = z.object({
  voucher_id: z.string().uuid(),
  status: z.enum(["issued", "redeemed", "void"]),
});
export type TVoucherVoidOutput = z.infer<typeof VoucherVoidOutput>;
