import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { searchDescriptors } from "../descriptors/search";

export type SearchClient = {
  places(
    input: InferInput<(typeof searchDescriptors)["search.places"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof searchDescriptors)["search.places"]>>;
};

export function createSearchClient(client: FunctionCaller<FunctionMap>): SearchClient {
  return {
    places(input, options) {
      return client.call("search.places", input, options);
    },
  };
}
