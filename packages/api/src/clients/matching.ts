import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { matchingDescriptors } from "../descriptors/matching";

export type MatchingClient = {
  assembleItinerary(
    input: InferInput<(typeof matchingDescriptors)["itinerary.assemble"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof matchingDescriptors)["itinerary.assemble"]>>;
  supplierMatch(
    input: InferInput<(typeof matchingDescriptors)["supplier.match"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof matchingDescriptors)["supplier.match"]>>;
  reservationHandle(
    input: InferInput<(typeof matchingDescriptors)["reservation.handle"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof matchingDescriptors)["reservation.handle"]>>;
};

export function createMatchingClient(client: FunctionCaller<FunctionMap>): MatchingClient {
  return {
    assembleItinerary(input, options) {
      return client.call("itinerary.assemble", input, options);
    },
    supplierMatch(input, options) {
      return client.call("supplier.match", input, options);
    },
    reservationHandle(input, options) {
      return client.call("reservation.handle", input, options);
    },
  };
}
