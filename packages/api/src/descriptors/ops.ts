import type { DescriptorMap } from "../types";
import { paginatedResponse } from "../internal/schemas";
import { OpsBookingsQuery, OpsExceptionsQuery } from "@ecotrips/types";

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
} satisfies DescriptorMap;
