import type { DescriptorMap } from "../types";
import { paginatedResponse } from "../internal/schemas";
import {
  OpsBookingsQuery,
  OpsExceptionsQuery,
  OpsSupplierSlaForecastQuery,
  SupplierSlaForecastResponse,
} from "@ecotrips/types";

export const opsDescriptors = {
  "ops.bookings": {
    path: "/functions/v1/ops-bookings",
    method: "GET",
    auth: "user",
    input: OpsBookingsQuery.default({}),
    output: paginatedResponse,
  },
  "ops.exceptions": {
    path: "/functions/v1/ops-exceptions",
    method: "GET",
    auth: "user",
    input: OpsExceptionsQuery.default({}),
    output: paginatedResponse,
  },
  "ops.supplierSlaForecast": {
    path: "/functions/v1/supplier-sla-forecast",
    method: "GET",
    auth: "user",
    input: OpsSupplierSlaForecastQuery.default({}),
    output: SupplierSlaForecastResponse,
  },
} satisfies DescriptorMap;
