import { assertEquals, assert } from "https://deno.land/std@0.224.0/testing/asserts.ts";

import {
  buildWarnings,
  isNightTravel,
  requiresLateArrivalCheck,
} from "./warnings.ts";

Deno.test("flags night travel using Kigali timezone boundaries", () => {
  const safeDeparture = new Date("2025-03-10T17:00:00+02:00");
  const nightDeparture = new Date("2025-03-10T20:15:00+02:00");

  assert(!isNightTravel(safeDeparture));
  assert(isNightTravel(nightDeparture));
});

Deno.test("flags late arrival checks for arrivals after 21:00 Kigali time", () => {
  const onTimeArrival = new Date("2025-03-10T20:30:00+02:00");
  const lateArrival = new Date("2025-03-10T22:05:00+02:00");

  assert(!requiresLateArrivalCheck(onTimeArrival));
  assert(requiresLateArrivalCheck(lateArrival));
});

Deno.test("buildWarnings aggregates both safety flags", () => {
  const departure = new Date("2025-03-10T19:30:00+02:00");
  const arrival = new Date("2025-03-10T22:45:00+02:00");

  const warnings = buildWarnings(departure, arrival);
  assertEquals(warnings, ["night_travel", "late_arrival_check_required"]);
});
