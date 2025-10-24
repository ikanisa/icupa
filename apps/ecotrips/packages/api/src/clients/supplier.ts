import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { supplierDescriptors } from "../descriptors/supplier";

export type SupplierClient = {
  orders(
    input?: InferInput<(typeof supplierDescriptors)["supplier.orders"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof supplierDescriptors)["supplier.orders"]>>;
  confirm(
    input: InferInput<(typeof supplierDescriptors)["supplier.confirm"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof supplierDescriptors)["supplier.confirm"]>>;
};

export function createSupplierClient(client: FunctionCaller<FunctionMap>): SupplierClient {
  return {
    orders(input, options) {
      const payload = (input ?? {}) as InferInput<(typeof supplierDescriptors)["supplier.orders"]>;
      return client.call("supplier.orders", payload, options);
    },
    confirm(input, options) {
      return client.call("supplier.confirm", input, options);
    },
  };
}
