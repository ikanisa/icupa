import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { permitsDescriptors } from "../descriptors/permits";

export type PermitsClient = {
  request(
    input: InferInput<(typeof permitsDescriptors)["permits.request"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof permitsDescriptors)["permits.request"]>>;
};

export function createPermitsClient(client: FunctionCaller<FunctionMap>): PermitsClient {
  return {
    request(input, options) {
      return client.call("permits.request", input, options);
    },
  };
}
