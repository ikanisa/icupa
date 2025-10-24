import {
  assert,
  assertEquals,
  assertFalse,
} from "jsr:@std/assert";

import {
  buildWarnings,
  normalizeWarningOutputs,
} from "./warnings.ts";

function kigaliDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
) {
  return new Date(Date.UTC(year, month - 1, day, hour - 2, minute));
}

Deno.test("guards against malformed itineraries", () => {
  const invalid = new Date(NaN);
  const end = kigaliDate(2025, 1, 1, 10, 0);
  const warnings = buildWarnings(invalid, end);
  assertEquals(warnings.length, 1);
  assertEquals(warnings[0]?.type, "schedule_invalid");
});

Deno.test("night travel triggers when departing before sunrise", () => {
  const start = kigaliDate(2025, 1, 1, 5, 0);
  const end = kigaliDate(2025, 1, 1, 6, 30);
  const warnings = buildWarnings(start, end);
  assert(warnings.some((warning) => warning.type === "night_travel"));
  const detail = warnings.find((warning) => warning.type === "night_travel");
  assert(detail?.meta?.departure_local_date);
});

Deno.test("sunrise boundary avoids false positives", () => {
  const start = kigaliDate(2025, 1, 1, 6, 16);
  const end = kigaliDate(2025, 1, 1, 7, 0);
  const warnings = buildWarnings(start, end);
  assertFalse(warnings.some((warning) => warning.type === "night_travel"));
});

Deno.test("late arrival covers after-sunset arrivals", () => {
  const start = kigaliDate(2025, 6, 1, 12, 0);
  const end = kigaliDate(2025, 6, 1, 20, 30);
  const warnings = buildWarnings(start, end);
  const lateArrival = warnings.find((warning) =>
    warning.type === "late_arrival_check_required"
  );
  assert(lateArrival);
  assertEquals(lateArrival.meta?.arrival_local_date, "2025-06-01");
});

Deno.test("late arrival also covers pre-sunrise landings on next day", () => {
  const start = kigaliDate(2025, 8, 1, 14, 0);
  const end = kigaliDate(2025, 8, 2, 4, 30);
  const warnings = buildWarnings(start, end);
  const lateArrival = warnings.find((warning) =>
    warning.type === "late_arrival_check_required"
  );
  assert(lateArrival);
  assertEquals(lateArrival.meta?.arrival_local_date, "2025-08-02");
  assertEquals(lateArrival.meta?.local_day_offset_days, 1);
});

Deno.test("normalizeWarningOutputs preserves legacy strings", () => {
  const results = normalizeWarningOutputs([
    "night_travel",
    { type: "custom", severity: "critical", message: "Check" },
  ]);
  assertEquals(results.legacyTypes, ["night_travel", "custom"]);
  assertEquals(results.details[0]?.severity, "medium");
  assertEquals(results.details[1]?.severity, "critical");
});
