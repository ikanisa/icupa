import { checkoutDescriptors } from "./checkout";
import { drDescriptors } from "./dr";
import { financeDescriptors } from "./finance";
import { groupsDescriptors } from "./groups";
import { inventoryDescriptors } from "./inventory";
import { opsDescriptors } from "./ops";
import { permitsDescriptors } from "./permits";
import { privacyDescriptors } from "./privacy";
import { walletDescriptors } from "./wallet";
import { mapsDescriptors } from "./maps";
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
  ...mapsDescriptors,
} as const satisfies DescriptorMap;

export type DescriptorKey = keyof typeof descriptors;
export type FunctionMap = typeof descriptors;
