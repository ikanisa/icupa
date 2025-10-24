import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { supportDescriptors } from "../descriptors/support";

export type SupportClient = {
  sosContacts(
    input?: InferInput<(typeof supportDescriptors)["support.sosContacts"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof supportDescriptors)["support.sosContacts"]>>;
  sosAction(
    input: InferInput<(typeof supportDescriptors)["support.sosAction"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof supportDescriptors)["support.sosAction"]>>;
};

export function createSupportClient(client: FunctionCaller<FunctionMap>): SupportClient {
  return {
    sosContacts(input, options) {
      const payload = (input ?? {}) as InferInput<(typeof supportDescriptors)["support.sosContacts"]>;
      return client.call("support.sosContacts", payload, options);
    },
    sosAction(input, options) {
      return client.call("support.sosAction", input, options);
    },
  };
}
