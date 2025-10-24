import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { groupsDescriptors } from "../descriptors/groups";

export type GroupsClient = {
  create(
    input: InferInput<(typeof groupsDescriptors)["groups.create"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof groupsDescriptors)["groups.create"]>>;
  join(
    input: InferInput<(typeof groupsDescriptors)["groups.join"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof groupsDescriptors)["groups.join"]>>;
  contribute(
    input: InferInput<(typeof groupsDescriptors)["groups.contribute"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof groupsDescriptors)["groups.contribute"]>>;
  suggest(
    input?: InferInput<(typeof groupsDescriptors)["groups.suggest"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof groupsDescriptors)["groups.suggest"]>>;
  payoutsReport(
    input?: InferInput<(typeof groupsDescriptors)["groups.payouts.report"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof groupsDescriptors)["groups.payouts.report"]>>;
  payoutNow(
    input: InferInput<(typeof groupsDescriptors)["groups.ops.payoutNow"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof groupsDescriptors)["groups.ops.payoutNow"]>>;
};

export function createGroupsClient(client: FunctionCaller<FunctionMap>): GroupsClient {
  return {
    create(input, options) {
      return client.call("groups.create", input, options);
    },
    join(input, options) {
      return client.call("groups.join", input, options);
    },
    contribute(input, options) {
      return client.call("groups.contribute", input, options);
    },
    suggest(input, options) {
      const payload = (input ?? {}) as InferInput<(typeof groupsDescriptors)["groups.suggest"]>;
      return client.call("groups.suggest", payload, options);
    },
    payoutsReport(input, options) {
      const payload = (input ?? {}) as InferInput<(typeof groupsDescriptors)["groups.payouts.report"]>;
      return client.call("groups.payouts.report", payload, options);
    },
    payoutNow(input, options) {
      return client.call("groups.ops.payoutNow", input, options);
    },
  };
}
