import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { growthDescriptors } from "../descriptors/growth";

export type GrowthClient = {
  referralLink(
    input: InferInput<(typeof growthDescriptors)["growth.referral_link"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof growthDescriptors)["growth.referral_link"]>>;
  rewardGrant(
    input: InferInput<(typeof growthDescriptors)["growth.reward_grant"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof growthDescriptors)["growth.reward_grant"]>>;
  priceLockOffer(
    input: InferInput<(typeof growthDescriptors)["growth.price_lock_offer"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof growthDescriptors)["growth.price_lock_offer"]>>;
  holdExtend(
    input: InferInput<(typeof growthDescriptors)["growth.hold_extend"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof growthDescriptors)["growth.hold_extend"]>>;
  providersAirStatus(
    input?: InferInput<(typeof growthDescriptors)["growth.air_status"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof growthDescriptors)["growth.air_status"]>>;
  rebookSuggest(
    input: InferInput<(typeof growthDescriptors)["growth.rebook_suggest"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof growthDescriptors)["growth.rebook_suggest"]>>;
};

export function createGrowthClient(client: FunctionCaller<FunctionMap>): GrowthClient {
  return {
    referralLink(input, options) {
      return client.call("growth.referral_link", input, options);
    },
    rewardGrant(input, options) {
      return client.call("growth.reward_grant", input, options);
    },
    priceLockOffer(input, options) {
      return client.call("growth.price_lock_offer", input, options);
    },
    holdExtend(input, options) {
      return client.call("growth.hold_extend", input, options);
    },
    providersAirStatus(input, options) {
      return client.call("growth.air_status", input ?? {}, options);
    },
    rebookSuggest(input, options) {
      return client.call("growth.rebook_suggest", input, options);
    },
  };
}
