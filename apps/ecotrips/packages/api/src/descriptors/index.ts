import { checkoutDescriptors } from "./checkout";
import { airDescriptors } from "./air";
import { conciergeDescriptors } from "./concierge";
import { drDescriptors } from "./dr";
import { financeDescriptors } from "./finance";
import { flagsDescriptors } from "./flags";
import { growthDescriptors } from "./growth";
import { groupsDescriptors } from "./groups";
import { inventoryDescriptors } from "./inventory";
import { loyaltyDescriptors } from "./loyalty";
import { mapsDescriptors } from "./maps";
import { notifyDescriptors } from "./notify";
import { opsDescriptors } from "./ops";
import { permitsDescriptors } from "./permits";
import { pricingDescriptors } from "./pricing";
import { privacyDescriptors } from "./privacy";
import { helpersDescriptors } from "./helpers";
import { supportDescriptors } from "./support";
import { voiceDescriptors } from "./voice";
import { walletDescriptors } from "./wallet";
import { adminDescriptors } from "./admin";
import { supplierDescriptors } from "./supplier";
import { userDescriptors } from "./user";
import { chatDescriptors } from "./chat";
import { searchDescriptors } from "./search";
import { travelDescriptors } from "./travel";
import { matchingDescriptors } from "./matching";
import type { DescriptorMap } from "../types";

export const descriptors = {
  ...airDescriptors,
  ...inventoryDescriptors,
  ...growthDescriptors,
  ...checkoutDescriptors,
  ...conciergeDescriptors,
  ...groupsDescriptors,
  ...flagsDescriptors,
  ...permitsDescriptors,
  ...walletDescriptors,
  ...opsDescriptors,
  ...helpersDescriptors,
  ...financeDescriptors,
  ...pricingDescriptors,
  ...loyaltyDescriptors,
  ...mapsDescriptors,
  ...notifyDescriptors,
  ...privacyDescriptors,
  ...supportDescriptors,
  ...voiceDescriptors,
  ...drDescriptors,
  ...adminDescriptors,
  ...supplierDescriptors,
  ...userDescriptors,
  ...chatDescriptors,
  ...searchDescriptors,
  ...travelDescriptors,
  ...matchingDescriptors,
} as const satisfies DescriptorMap;

export type DescriptorKey = keyof typeof descriptors;
export type FunctionMap = typeof descriptors;
