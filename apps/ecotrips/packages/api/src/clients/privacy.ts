import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { privacyDescriptors } from "../descriptors/privacy";

export type PrivacyClient = {
  request(
    input: InferInput<(typeof privacyDescriptors)["privacy.request"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof privacyDescriptors)["privacy.request"]>>;
  review(
    input: InferInput<(typeof privacyDescriptors)["privacy.review"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof privacyDescriptors)["privacy.review"]>>;
  exportData(
    input: InferInput<(typeof privacyDescriptors)["privacy.export"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof privacyDescriptors)["privacy.export"]>>;
  planErasure(
    input: InferInput<(typeof privacyDescriptors)["privacy.erasure.plan"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof privacyDescriptors)["privacy.erasure.plan"]>>;
  executeErasure(
    input: InferInput<(typeof privacyDescriptors)["privacy.erasure.execute"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof privacyDescriptors)["privacy.erasure.execute"]>>;
  scanPii(
    input: InferInput<(typeof privacyDescriptors)["privacy.pii.scan"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof privacyDescriptors)["privacy.pii.scan"]>>;
};

export function createPrivacyClient(client: FunctionCaller<FunctionMap>): PrivacyClient {
  return {
    request(input, options) {
      return client.call("privacy.request", input, options);
    },
    review(input, options) {
      return client.call("privacy.review", input, options);
    },
    exportData(input, options) {
      return client.call("privacy.export", input, options);
    },
    planErasure(input, options) {
      return client.call("privacy.erasure.plan", input, options);
    },
    executeErasure(input, options) {
      return client.call("privacy.erasure.execute", input, options);
    },
    scanPii(input, options) {
      return client.call("privacy.pii.scan", input, options);
    },
  };
}
