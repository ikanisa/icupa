import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { voiceDescriptors } from "../descriptors/voice";

export type VoiceClient = {
  initiateCall(
    input: InferInput<(typeof voiceDescriptors)["voice.call.initiate"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof voiceDescriptors)["voice.call.initiate"]>>;
  summarizeCall(
    input: InferInput<(typeof voiceDescriptors)["voice.call.summarize"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof voiceDescriptors)["voice.call.summarize"]>>;
};

export function createVoiceClient(client: FunctionCaller<FunctionMap>): VoiceClient {
  return {
    initiateCall(input, options) {
      return client.call("voice.call.initiate", input, options);
    },
    summarizeCall(input, options) {
      return client.call("voice.call.summarize", input, options);
    },
  };
}
