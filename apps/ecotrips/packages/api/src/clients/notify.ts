import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { notifyDescriptors } from "../descriptors/notify";

export type NotifyClient = {
  pushSubscribe(
    input: InferInput<(typeof notifyDescriptors)["notify.pushSubscribe"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof notifyDescriptors)["notify.pushSubscribe"]>>;
  pushSend(
    input: InferInput<(typeof notifyDescriptors)["notify.pushSend"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof notifyDescriptors)["notify.pushSend"]>>;
};

export function createNotifyClient(client: FunctionCaller<FunctionMap>): NotifyClient {
  return {
    pushSubscribe(input, options) {
      return client.call("notify.pushSubscribe", input, options);
    },
    pushSend(input, options) {
      return client.call("notify.pushSend", input, options);
    },
  };
}
