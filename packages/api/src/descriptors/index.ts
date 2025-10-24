import { checkoutDescriptors } from "./checkout";
import { airDescriptors } from "./air";
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
import { notifyDescriptors } from "./notify";
import { supportDescriptors } from "./support";
import { chatDescriptors } from "./chat";
import type { DescriptorMap } from "../types";

export const descriptors = {
  ...airDescriptors,
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
  ...notifyDescriptors,
  ...supportDescriptors,
  ...chatDescriptors,
} as const satisfies DescriptorMap;

export type DescriptorKey = keyof typeof descriptors;
export type FunctionMap = typeof descriptors;
