import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { drDescriptors } from "../descriptors/dr";

export type DisasterRecoveryClient = {
  snapshot(
    input: InferInput<(typeof drDescriptors)["dr.snapshot"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof drDescriptors)["dr.snapshot"]>>;
};

export function createDisasterRecoveryClient(
  client: FunctionCaller<FunctionMap>,
): DisasterRecoveryClient {
  return {
    snapshot(input, options) {
      return client.call("dr.snapshot", input, options);
    },
  };
}
