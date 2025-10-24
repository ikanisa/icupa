import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { pricingDescriptors } from "../descriptors/pricing";

export type PricingClient = {
  apply(
    input: InferInput<(typeof pricingDescriptors)["pricing.apply"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof pricingDescriptors)["pricing.apply"]>>;
};

export function createPricingClient(client: FunctionCaller<FunctionMap>): PricingClient {
  return {
    apply(input, options) {
      return client.call("pricing.apply", input, options);
    },
  };
}
