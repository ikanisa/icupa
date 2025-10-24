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
import { createSupplierClient, type SupplierClient } from "./supplier";
import { createFlagsClient, type FlagsClient } from "./flags";
import { createAdminClient, type AdminClient } from "./admin";

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
  supplier: SupplierClient;
  flags: FlagsClient;
  admin: AdminClient;
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
    supplier: createSupplierClient(client),
    flags: createFlagsClient(client),
    admin: createAdminClient(client),
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
export * from "./supplier";
export * from "./flags";
export * from "./admin";
