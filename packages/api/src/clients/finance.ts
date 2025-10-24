import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { financeDescriptors } from "../descriptors/finance";

export type FinanceClient = {
  generateInvoice(
    input: InferInput<(typeof financeDescriptors)["fin.invoice.generate"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof financeDescriptors)["fin.invoice.generate"]>>;
  summarizeRefundPolicy(
    input: InferInput<(typeof financeDescriptors)["fin.refund.policySummarize"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof financeDescriptors)["fin.refund.policySummarize"]>>;
};

export function createFinanceClient(client: FunctionCaller<FunctionMap>): FinanceClient {
  return {
    generateInvoice(input, options) {
      return client.call("fin.invoice.generate", input, options);
    },
    summarizeRefundPolicy(input, options) {
      return client.call("fin.refund.policySummarize", input, options);
    },
  };
}
