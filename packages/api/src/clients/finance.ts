import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { financeDescriptors } from "../descriptors/finance";

export type FinanceClient = {
  generateInvoice(
    input: InferInput<(typeof financeDescriptors)["fin.invoice.generate"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof financeDescriptors)["fin.invoice.generate"]>>;
};

export function createFinanceClient(client: FunctionCaller<FunctionMap>): FinanceClient {
  return {
    generateInvoice(input, options) {
      return client.call("fin.invoice.generate", input, options);
    },
  };
}
