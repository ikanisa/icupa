import { checkoutDescriptors } from "./checkout";
import { conciergeDescriptors } from "./concierge";
import { drDescriptors } from "./dr";
import { financeDescriptors } from "./finance";
import { groupsDescriptors } from "./groups";
import { inventoryDescriptors } from "./inventory";
import { loyaltyDescriptors } from "./loyalty";
import { opsDescriptors } from "./ops";
import { permitsDescriptors } from "./permits";
import { pricingDescriptors } from "./pricing";
import { privacyDescriptors } from "./privacy";
import { walletDescriptors } from "./wallet";
import { userDescriptors } from "./user";
import type { DescriptorMap } from "../types";

export const descriptors = {
  ...inventoryDescriptors,
  ...growthDescriptors,
  ...checkoutDescriptors,
  ...conciergeDescriptors,
  ...groupsDescriptors,
  ...permitsDescriptors,
  ...walletDescriptors,
  ...opsDescriptors,
  ...financeDescriptors,
  ...pricingDescriptors,
  ...loyaltyDescriptors,
  ...privacyDescriptors,
  ...drDescriptors,
  ...userDescriptors,
} as const satisfies DescriptorMap;

export type DescriptorKey = keyof typeof descriptors;
export type FunctionMap = typeof descriptors;
