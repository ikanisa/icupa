import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { loyaltyDescriptors } from "../descriptors/loyalty";

export type LoyaltyClient = {
  grant(
    input: InferInput<(typeof loyaltyDescriptors)["loyalty.grant"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof loyaltyDescriptors)["loyalty.grant"]>>;
};

export function createLoyaltyClient(client: FunctionCaller<FunctionMap>): LoyaltyClient {
  return {
    grant(input, options) {
      return client.call("loyalty.grant", input, options);
    },
  };
}
