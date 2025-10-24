import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { chatDescriptors } from "../descriptors/chat";

export type ChatClient = {
  voiceSession(
    input: InferInput<(typeof chatDescriptors)["chat.voiceSession"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof chatDescriptors)["chat.voiceSession"]>>;
};

export function createChatClient(client: FunctionCaller<FunctionMap>): ChatClient {
  return {
    voiceSession(input, options) {
      return client.call("chat.voiceSession", input, options);
    },
  };
}
