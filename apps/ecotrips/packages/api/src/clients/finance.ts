import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { financeDescriptors } from "../descriptors/finance";

export type FinanceClient = {
  generateInvoice(
    input: InferInput<(typeof financeDescriptors)["fin.invoice.generate"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof financeDescriptors)["fin.invoice.generate"]>>;
  quoteFx(
    input: InferInput<(typeof financeDescriptors)["fin.fx.rateQuote"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof financeDescriptors)["fin.fx.rateQuote"]>>;
};

export function createFinanceClient(client: FunctionCaller<FunctionMap>): FinanceClient {
  return {
    generateInvoice(input, options) {
      return client.call("fin.invoice.generate", input, options);
    },
    quoteFx(input, options) {
      return client.call("fin.fx.rateQuote", input, options);
    },
  };
}
