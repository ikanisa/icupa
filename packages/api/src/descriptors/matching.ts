import type { DescriptorMap } from "../types";
import {
  ItineraryAssemblyInput,
  ItineraryAssemblyResponse,
  ReservationHandleInput,
  ReservationHandleResponse,
  SupplierMatchInput,
  SupplierMatchResponse,
} from "@ecotrips/types";

export const matchingDescriptors = {
  "itinerary.assemble": {
    path: "/functions/v1/itinerary-assemble",
    method: "POST",
    auth: "service_role",
    input: ItineraryAssemblyInput,
    output: ItineraryAssemblyResponse,
  },
  "supplier.match": {
    path: "/functions/v1/supplier-match",
    method: "POST",
    auth: "service_role",
    input: SupplierMatchInput,
    output: SupplierMatchResponse,
  },
  "reservation.handle": {
    path: "/functions/v1/reservation-handle",
    method: "POST",
    auth: "service_role",
    input: ReservationHandleInput,
    output: ReservationHandleResponse,
  },
} satisfies DescriptorMap;
