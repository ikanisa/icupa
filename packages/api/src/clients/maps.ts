import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { mapsDescriptors } from "../descriptors/maps";

export type MapsClient = {
  tilesList(
    input?: InferInput<(typeof mapsDescriptors)["maps.tiles.list"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof mapsDescriptors)["maps.tiles.list"]>>;
};

export function createMapsClient(client: FunctionCaller<FunctionMap>): MapsClient {
  return {
    tilesList(input, options) {
      return client.call("maps.tiles.list", input ?? {}, options);
    },
  };
}
