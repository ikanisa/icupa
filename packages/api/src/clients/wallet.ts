import type { FunctionCaller, InferInput, InferOutput, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";
import { walletDescriptors } from "../descriptors/wallet";

export type WalletClient = {
  offlinePack(
    input: InferInput<(typeof walletDescriptors)["wallet.offlinePack"]>,
    options?: RequestOptions,
  ): Promise<InferOutput<(typeof walletDescriptors)["wallet.offlinePack"]>>;
};

export function createWalletClient(client: FunctionCaller<FunctionMap>): WalletClient {
  return {
    offlinePack(input, options) {
      return client.call("wallet.offlinePack", input, options);
    },
  };
}
