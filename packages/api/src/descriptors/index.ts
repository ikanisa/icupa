import { checkoutDescriptors } from "./checkout";
import { airDescriptors } from "./air";
import { drDescriptors } from "./dr";
import { financeDescriptors } from "./finance";
import { groupsDescriptors } from "./groups";
import { inventoryDescriptors } from "./inventory";
import { opsDescriptors } from "./ops";
import { permitsDescriptors } from "./permits";
import { privacyDescriptors } from "./privacy";
import { walletDescriptors } from "./wallet";
import type { DescriptorMap } from "../types";

export const descriptors = {
  ...airDescriptors,
  ...inventoryDescriptors,
  ...checkoutDescriptors,
  ...groupsDescriptors,
  ...permitsDescriptors,
  ...walletDescriptors,
  ...opsDescriptors,
  ...financeDescriptors,
  ...privacyDescriptors,
  ...drDescriptors,
} as const satisfies DescriptorMap;

export type DescriptorKey = keyof typeof descriptors;
export type FunctionMap = typeof descriptors;
