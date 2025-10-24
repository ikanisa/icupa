import type { FunctionCaller } from "../types";
import type { FunctionMap } from "../descriptors";
import { createCheckoutClient, type CheckoutClient } from "./checkout";
import { createDisasterRecoveryClient, type DisasterRecoveryClient } from "./dr";
import { createFinanceClient, type FinanceClient } from "./finance";
import { createGroupsClient, type GroupsClient } from "./groups";
import { createInventoryClient, type InventoryClient } from "./inventory";
import { createOpsClient, type OpsClient } from "./ops";
import { createPermitsClient, type PermitsClient } from "./permits";
import { createPrivacyClient, type PrivacyClient } from "./privacy";
import { createWalletClient, type WalletClient } from "./wallet";
import { createNotifyClient, type NotifyClient } from "./notify";
import { createSupportClient, type SupportClient } from "./support";
import { createChatClient, type ChatClient } from "./chat";

export type DomainClients = {
  inventory: InventoryClient;
  checkout: CheckoutClient;
  groups: GroupsClient;
  permits: PermitsClient;
  wallet: WalletClient;
  ops: OpsClient;
  finance: FinanceClient;
  privacy: PrivacyClient;
  dr: DisasterRecoveryClient;
  notify: NotifyClient;
  support: SupportClient;
  chat: ChatClient;
};

export function createDomainClients(client: FunctionCaller<FunctionMap>): DomainClients {
  return {
    inventory: createInventoryClient(client),
    checkout: createCheckoutClient(client),
    groups: createGroupsClient(client),
    permits: createPermitsClient(client),
    wallet: createWalletClient(client),
    ops: createOpsClient(client),
    finance: createFinanceClient(client),
    privacy: createPrivacyClient(client),
    dr: createDisasterRecoveryClient(client),
    notify: createNotifyClient(client),
    support: createSupportClient(client),
    chat: createChatClient(client),
  };
}

export * from "./checkout";
export * from "./dr";
export * from "./finance";
export * from "./groups";
export * from "./inventory";
export * from "./ops";
export * from "./permits";
export * from "./privacy";
export * from "./wallet";
export * from "./notify";
export * from "./support";
export * from "./chat";
