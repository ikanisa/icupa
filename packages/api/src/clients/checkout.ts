import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { checkoutDescriptors } from "../descriptors/checkout";

export type CheckoutClient = {
  intent(
    input: InferInput<(typeof checkoutDescriptors)["checkout.intent"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof checkoutDescriptors)["checkout.intent"]>>;
};

export function createCheckoutClient(client: FunctionCaller<FunctionMap>): CheckoutClient {
  return {
    intent(input, options) {
      return client.call("checkout.intent", input, options);
    },
  };
}
