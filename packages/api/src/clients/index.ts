import type { FunctionCaller } from "../types";
import type { FunctionMap } from "../descriptors";
import { createCheckoutClient, type CheckoutClient } from "./checkout";
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

export type DomainClients = {
  inventory: InventoryClient;
  checkout: CheckoutClient;
  groups: GroupsClient;
  permits: PermitsClient;
  wallet: WalletClient;
  ops: OpsClient;
  finance: FinanceClient;
  pricing: PricingClient;
  loyalty: LoyaltyClient;
  privacy: PrivacyClient;
  dr: DisasterRecoveryClient;
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
    pricing: createPricingClient(client),
    loyalty: createLoyaltyClient(client),
    privacy: createPrivacyClient(client),
    dr: createDisasterRecoveryClient(client),
  };
}

export * from "./checkout";
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
