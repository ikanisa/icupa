import { zodToJsonSchema } from "zod-to-json-schema";
import {
  VoucherCreateInput,
  VoucherRedeemInput,
  VoucherVoidInput,
} from "./voucher.schema";
import { LookupCustomerInput } from "./customer.schema";
import { WebsearchInput } from "./websearch.schema";

export const toolSchemas = {
  create_voucher: zodToJsonSchema(VoucherCreateInput, "create_voucher"),
  lookup_customer: zodToJsonSchema(LookupCustomerInput, "lookup_customer"),
  redeem_voucher: zodToJsonSchema(VoucherRedeemInput, "redeem_voucher"),
  void_voucher: zodToJsonSchema(VoucherVoidInput, "void_voucher"),
  websearch_query: zodToJsonSchema(WebsearchInput, "websearch_query"),
};

// Re-export all schemas for convenience
export * from "./voucher.schema";
export * from "./customer.schema";
export * from "./tool.common";
export * from "./websearch.schema";
