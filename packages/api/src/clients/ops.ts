import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { opsDescriptors } from "../descriptors/ops";

export type OpsClient = {
  bookings(
    input?: InferInput<(typeof opsDescriptors)["ops.bookings"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof opsDescriptors)["ops.bookings"]>>;
  exceptions(
    input?: InferInput<(typeof opsDescriptors)["ops.exceptions"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof opsDescriptors)["ops.exceptions"]>>;
};

export function createOpsClient(client: FunctionCaller<FunctionMap>): OpsClient {
  return {
    bookings(input, options) {
      const payload = (input ?? {}) as InferInput<(typeof opsDescriptors)["ops.bookings"]>;
      return client.call("ops.bookings", payload, options);
    },
    exceptions(input, options) {
      const payload = (input ?? {}) as InferInput<(typeof opsDescriptors)["ops.exceptions"]>;
      return client.call("ops.exceptions", payload, options);
    },
  };
}
