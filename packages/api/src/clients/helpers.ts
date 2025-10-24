import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { helpersDescriptors } from "../descriptors/helpers";

export type HelpersClient = {
  priceBreakdown(
    input: InferInput<(typeof helpersDescriptors)["helpers.price"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof helpersDescriptors)["helpers.price"]>>;
};

export function createHelpersClient(client: FunctionCaller<FunctionMap>): HelpersClient {
  return {
    priceBreakdown(input, options) {
      return client.call("helpers.price", input, options);
    },
  };
}
