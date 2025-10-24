import type { FunctionCaller } from "../types";
import type { FunctionMap } from "../descriptors";
import { createCheckoutClient, type CheckoutClient } from "./checkout";
import { createConciergeClient, type ConciergeClient } from "./concierge";
import { createDisasterRecoveryClient, type DisasterRecoveryClient } from "./dr";
import { createFinanceClient, type FinanceClient } from "./finance";
import { createGroupsClient, type GroupsClient } from "./groups";
import { createInventoryClient, type InventoryClient } from "./inventory";
import { createLoyaltyClient, type LoyaltyClient } from "./loyalty";
import { createOpsClient, type OpsClient } from "./ops";
import { createPermitsClient, type PermitsClient } from "./permits";
import { createPricingClient, type PricingClient } from "./pricing";
import { createPrivacyClient, type PrivacyClient } from "./privacy";
import { createWalletClient, type WalletClient } from "./wallet";
import { createAirClient, type AirClient } from "./air";

export type DomainClients = {
  air: AirClient;
  inventory: InventoryClient;
  growth: GrowthClient;
  checkout: CheckoutClient;
  concierge: ConciergeClient;
  groups: GroupsClient;
  permits: PermitsClient;
  wallet: WalletClient;
  ops: OpsClient;
  finance: FinanceClient;
  pricing: PricingClient;
  loyalty: LoyaltyClient;
  privacy: PrivacyClient;
  dr: DisasterRecoveryClient;
  notify: NotifyClient;
  support: SupportClient;
  chat: ChatClient;
};

export function createDomainClients(client: FunctionCaller<FunctionMap>): DomainClients {
  return {
    air: createAirClient(client),
    inventory: createInventoryClient(client),
    growth: createGrowthClient(client),
    checkout: createCheckoutClient(client),
    concierge: createConciergeClient(client),
    groups: createGroupsClient(client),
    permits: createPermitsClient(client),
    wallet: createWalletClient(client),
    ops: createOpsClient(client),
    finance: createFinanceClient(client),
    pricing: createPricingClient(client),
    loyalty: createLoyaltyClient(client),
    privacy: createPrivacyClient(client),
    dr: createDisasterRecoveryClient(client),
    notify: createNotifyClient(client),
    support: createSupportClient(client),
    chat: createChatClient(client),
  };
}

export * from "./checkout";
export * from "./air";
export * from "./dr";
export * from "./finance";
export * from "./groups";
export * from "./inventory";
export * from "./loyalty";
export * from "./ops";
export * from "./permits";
export * from "./pricing";
export * from "./privacy";
export * from "./wallet";
export * from "./notify";
export * from "./support";
export * from "./chat";
