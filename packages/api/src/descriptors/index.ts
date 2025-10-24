import { checkoutDescriptors } from "./checkout";
import { drDescriptors } from "./dr";
import { financeDescriptors } from "./finance";
import { groupsDescriptors } from "./groups";
import { inventoryDescriptors } from "./inventory";
import { opsDescriptors } from "./ops";
import { permitsDescriptors } from "./permits";
import { privacyDescriptors } from "./privacy";
import { walletDescriptors } from "./wallet";
import { notifyDescriptors } from "./notify";
import { supportDescriptors } from "./support";
import { chatDescriptors } from "./chat";
import type { DescriptorMap } from "../types";

export const descriptors = {
  ...inventoryDescriptors,
  ...checkoutDescriptors,
  ...groupsDescriptors,
  ...permitsDescriptors,
  ...walletDescriptors,
  ...opsDescriptors,
  ...financeDescriptors,
  ...privacyDescriptors,
  ...drDescriptors,
  ...notifyDescriptors,
  ...supportDescriptors,
  ...chatDescriptors,
} as const satisfies DescriptorMap;

export type DescriptorKey = keyof typeof descriptors;
export type FunctionMap = typeof descriptors;
