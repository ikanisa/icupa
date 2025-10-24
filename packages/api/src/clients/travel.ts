import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { travelDescriptors } from "../descriptors/travel";

export type TravelClient = {
  air: {
    search(
      input: InferInput<(typeof travelDescriptors)["travel.air.search"]>,
      options?: RequestOptions,
    ): Promise<InferOutput<(typeof travelDescriptors)["travel.air.search"]>>;
    hold(
      input: InferInput<(typeof travelDescriptors)["travel.air.hold"]>,
      options?: RequestOptions,
    ): Promise<InferOutput<(typeof travelDescriptors)["travel.air.hold"]>>;
    priceWatch(
      input: InferInput<(typeof travelDescriptors)["travel.air.priceWatch"]>,
      options?: RequestOptions,
    ): Promise<InferOutput<(typeof travelDescriptors)["travel.air.priceWatch"]>>;
  };
  stay: {
    search(
      input: InferInput<(typeof travelDescriptors)["travel.stay.search"]>,
      options?: RequestOptions,
    ): Promise<InferOutput<(typeof travelDescriptors)["travel.stay.search"]>>;
    quote(
      input: InferInput<(typeof travelDescriptors)["travel.stay.quote"]>,
      options?: RequestOptions,
    ): Promise<InferOutput<(typeof travelDescriptors)["travel.stay.quote"]>>;
  };
};

export function createTravelClient(client: FunctionCaller<FunctionMap>): TravelClient {
  return {
    air: {
      search(input, options) {
        return client.call("travel.air.search", input, options);
      },
      hold(input, options) {
        return client.call("travel.air.hold", input, options);
      },
      priceWatch(input, options) {
        return client.call("travel.air.priceWatch", input, options);
      },
    },
    stay: {
      search(input, options) {
        return client.call("travel.stay.search", input, options);
      },
      quote(input, options) {
        return client.call("travel.stay.quote", input, options);
      },
    },
  };
}
