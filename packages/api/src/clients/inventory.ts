import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { inventoryDescriptors } from "../descriptors/inventory";

export type InventoryClient = {
  search(
    input: InferInput<(typeof inventoryDescriptors)["inventory.search"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof inventoryDescriptors)["inventory.search"]>>;
  quote(
    input: InferInput<(typeof inventoryDescriptors)["inventory.quote"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof inventoryDescriptors)["inventory.quote"]>>;
};

export function createInventoryClient(client: FunctionCaller<FunctionMap>): InventoryClient {
  return {
    search(input, options) {
      return client.call("inventory.search", input, options);
    },
    quote(input, options) {
      return client.call("inventory.quote", input, options);
    },
  };
}
