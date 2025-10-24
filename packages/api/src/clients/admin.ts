import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { adminDescriptors } from "../descriptors/admin";

export type AdminClient = {
  synthGenerate(
    input?: InferInput<(typeof adminDescriptors)["admin.synth.generate"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof adminDescriptors)["admin.synth.generate"]>>;
};

export function createAdminClient(client: FunctionCaller<FunctionMap>): AdminClient {
  return {
    synthGenerate(input, options) {
      const payload = (input ?? {}) as InferInput<(typeof adminDescriptors)["admin.synth.generate"]>;
      return client.call("admin.synth.generate", payload, options);
    },
  };
}
