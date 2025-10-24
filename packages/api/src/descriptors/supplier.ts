import { SupplierConfirmInput, SupplierConfirmResponse, SupplierOrdersRequest, SupplierOrdersResponse } from "@ecotrips/types";
import type { DescriptorMap } from "../types";

export const supplierDescriptors = {
  "supplier.orders": {
    path: "/functions/v1/supplier-orders",
    method: "GET",
    auth: "user",
    input: SupplierOrdersRequest.default({ include_badges: false }),
    output: SupplierOrdersResponse,
  },
  "supplier.confirm": {
    path: "/functions/v1/supplier-confirm",
    method: "POST",
    auth: "user",
    input: SupplierConfirmInput,
    output: SupplierConfirmResponse,
  },
} satisfies DescriptorMap;
