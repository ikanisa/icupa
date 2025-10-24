import { checkoutDescriptors } from "./checkout";
import { drDescriptors } from "./dr";
import { financeDescriptors } from "./finance";
import { groupsDescriptors } from "./groups";
import { inventoryDescriptors } from "./inventory";
import { growthDescriptors } from "./growth";
import { opsDescriptors } from "./ops";
import { permitsDescriptors } from "./permits";
import { privacyDescriptors } from "./privacy";
import { walletDescriptors } from "./wallet";
import type { DescriptorMap } from "../types";

export const descriptors = {
  ...inventoryDescriptors,
  ...growthDescriptors,
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
