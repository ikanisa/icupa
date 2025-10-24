import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { airDescriptors } from "../descriptors/air";

export type AirClient = {
  watch(
    input: InferInput<(typeof airDescriptors)["air.price.watch"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof airDescriptors)["air.price.watch"]>>;
};

export function createAirClient(client: FunctionCaller<FunctionMap>): AirClient {
  return {
    watch(input, options) {
      return client.call("air.price.watch", input, options);
    },
  };
}
