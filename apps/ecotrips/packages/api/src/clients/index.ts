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
import { createGrowthClient, type GrowthClient } from "./growth";
import { createTravelClient, type TravelClient } from "./travel";
import { createMatchingClient, type MatchingClient } from "./matching";
import { createMapsClient, type MapsClient } from "./maps";
import { createVoiceClient, type VoiceClient } from "./voice";
import { createNotifyClient, type NotifyClient } from "./notify";
import { createSupportClient, type SupportClient } from "./support";
import { createFlagsClient, type FlagsClient } from "./flags";
import { createAdminClient, type AdminClient } from "./admin";
import { createSupplierClient, type SupplierClient } from "./supplier";
import { createUserClient, type UserClient } from "./user";
import { createChatClient, type ChatClient } from "./chat";
import { createSearchClient, type SearchClient } from "./search";
import { createHelpersClient, type HelpersClient } from "./helpers";

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
  travel: TravelClient;
  matching: MatchingClient;
  maps: MapsClient;
  voice: VoiceClient;
  notify: NotifyClient;
  support: SupportClient;
  flags: FlagsClient;
  admin: AdminClient;
  supplier: SupplierClient;
  user: UserClient;
  chat: ChatClient;
  search: SearchClient;
  helpers: HelpersClient;
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
    travel: createTravelClient(client),
    matching: createMatchingClient(client),
    maps: createMapsClient(client),
    voice: createVoiceClient(client),
    notify: createNotifyClient(client),
    support: createSupportClient(client),
    flags: createFlagsClient(client),
    admin: createAdminClient(client),
    supplier: createSupplierClient(client),
    user: createUserClient(client),
    chat: createChatClient(client),
    search: createSearchClient(client),
    helpers: createHelpersClient(client),
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
export * from "./travel";
export * from "./matching";
export * from "./maps";
export * from "./voice";
export * from "./notify";
export * from "./support";
export * from "./flags";
export * from "./admin";
export * from "./supplier";
export * from "./user";
export * from "./chat";
export * from "./search";
export * from "./helpers";
