import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { flagsDescriptors } from "../descriptors/flags";

export type FlagsClient = {
  config(
    input?: InferInput<(typeof flagsDescriptors)["flags.config"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof flagsDescriptors)["flags.config"]>>;
};

export function createFlagsClient(client: FunctionCaller<FunctionMap>): FlagsClient {
  return {
    config(input, options) {
      const payload = (input ?? {}) as InferInput<(typeof flagsDescriptors)["flags.config"]>;
      return client.call("flags.config", payload, options);
    },
  };
}
