/**
 * Utilities for constructing map-route warnings.
 *
 * Kigali is the only supported market today, so all calculations assume the
 * Africa/Kigali time zone (UTC+02 with no daylight saving adjustments). The
 * helpers annotate where future multi-region logic can plug in.
 */
export type WarningSeverity = "low" | "medium" | "high" | "critical";

export interface WarningDetail {
  type: string;
  severity: WarningSeverity;
  message?: string;
  meta?: Record<string, unknown>;
}

const KIGALI_TIME_ZONE = "Africa/Kigali";
const MS_PER_DAY = 24 * 60 * 60 * 1_000;

interface KigaliClock {
  /** Minutes from midnight for easier comparisons. */
  minutesFromMidnight: number;
  /** The clock label (HH:MM) in Kigali's local time. */
  label: string;
  /** Month index (1-12) used for sunrise/sunset approximations. */
  month: number;
  /** Local date label (YYYY-MM-DD) to detect multi-day journeys. */
  dateLabel: string;
  /** Ordinal date value for comparisons across legs. */
  dateValue: number;
}

interface SunEvents {
  sunriseMinutes: number;
  sunsetMinutes: number;
}

const KIGALI_SUN_EVENTS: Record<number, SunEvents> = {
  1: { sunriseMinutes: 6 * 60 + 16, sunsetMinutes: 18 * 60 + 28 },
  2: { sunriseMinutes: 6 * 60 + 13, sunsetMinutes: 18 * 60 + 31 },
  3: { sunriseMinutes: 6 * 60 + 4, sunsetMinutes: 18 * 60 + 31 },
  4: { sunriseMinutes: 5 * 60 + 50, sunsetMinutes: 18 * 60 + 26 },
  5: { sunriseMinutes: 5 * 60 + 43, sunsetMinutes: 18 * 60 + 19 },
  6: { sunriseMinutes: 5 * 60 + 49, sunsetMinutes: 18 * 60 + 18 },
  7: { sunriseMinutes: 5 * 60 + 53, sunsetMinutes: 18 * 60 + 22 },
  8: { sunriseMinutes: 5 * 60 + 51, sunsetMinutes: 18 * 60 + 21 },
  9: { sunriseMinutes: 5 * 60 + 49, sunsetMinutes: 18 * 60 + 13 },
  10: { sunriseMinutes: 5 * 60 + 50, sunsetMinutes: 18 * 60 + 9 },
  11: { sunriseMinutes: 5 * 60 + 57, sunsetMinutes: 18 * 60 + 10 },
  12: { sunriseMinutes: 6 * 60 + 6, sunsetMinutes: 18 * 60 + 18 },
};

const DEFAULT_SUN_EVENTS: SunEvents = {
  sunriseMinutes: 6 * 60,
  sunsetMinutes: 18 * 60 + 15,
};

/**
 * Builds warnings for a two-leg itinerary.
 *
 * Kigali-specific assumptions:
 * - We treat sunrise/sunset using a simple month-based approximation and assume
 *   no DST transitions (true today, but the helpers expose month/time zone so
 *   future generalizations can pivot).
 * - Severe night travel warnings cover departure times before sunrise or after
 *   sunset; arrivals far past sunset request additional supplier confirmation.
 * - Multi-day itineraries carry the previous rule forward so pre-sunrise
 *   arrivals on the following morning still raise a late-arrival warning.
 */
export function buildWarnings(start: Date, end: Date): WarningDetail[] {
  const warnings: WarningDetail[] = [];

  if (!isSafeDate(start) || !isSafeDate(end)) {
    warnings.push({
      type: "schedule_invalid",
      severity: "critical",
      message: "Itinerary timing could not be parsed for Kigali local time.",
      meta: { provided_start: start?.toString(), provided_end: end?.toString() },
    });
    return warnings;
  }

  if (end.getTime() <= start.getTime()) {
    warnings.push({
      type: "schedule_invalid",
      severity: "critical",
      message: "Itinerary end time must be after start time.",
      meta: { start_iso: start.toISOString(), end_iso: end.toISOString() },
    });
    return warnings;
  }

  const startClock = toKigaliClock(start);
  const endClock = toKigaliClock(end);
  const sunEvents = getSunEvents(startClock.month);
  const localDayOffsetDays = Math.round(
    (endClock.dateValue - startClock.dateValue) / MS_PER_DAY,
  );

  if (isNightTravel(startClock, sunEvents)) {
    warnings.push({
      type: "night_travel",
      severity: "high",
      message:
        "Segment begins outside daylight hours for Kigali; confirm security and lighting.",
      meta: {
        time_zone: KIGALI_TIME_ZONE,
        departure_local: startClock.label,
        departure_local_date: startClock.dateLabel,
        sunrise_local: minutesToLabel(sunEvents.sunriseMinutes),
        sunset_local: minutesToLabel(sunEvents.sunsetMinutes),
      },
    });
  }

  const arrivalSunEvents = getSunEvents(endClock.month);
  const arrivalAfterSunset = isLateArrival(endClock, arrivalSunEvents);
  const arrivalBeforeSunrise = isBeforeSunrise(endClock, arrivalSunEvents);

  if (arrivalAfterSunset || (localDayOffsetDays > 0 && arrivalBeforeSunrise)) {
    warnings.push({
      type: "late_arrival_check_required",
      severity: "medium",
      message:
        "Arrival is scheduled after daylight; request supplier confirmation for gate access.",
      meta: {
        time_zone: KIGALI_TIME_ZONE,
        arrival_local: endClock.label,
        arrival_local_date: endClock.dateLabel,
        local_day_offset_days: localDayOffsetDays,
        sunset_local: minutesToLabel(arrivalSunEvents.sunsetMinutes),
      },
    });
  }

  return warnings;
}

/**
 * Normalizes warning outputs to provide both legacy string identifiers and
 * structured detail records.
 */
export function normalizeWarningOutputs(
  warnings: Array<WarningDetail | string>,
): { legacyTypes: string[]; details: WarningDetail[] } {
  const legacyTypes: string[] = [];
  const details: WarningDetail[] = [];

  for (const warning of warnings) {
    if (!warning) continue;

    if (typeof warning === "string") {
      legacyTypes.push(warning);
      details.push({ type: warning, severity: "medium" });
      continue;
    }

    const severity = normalizeSeverity(warning.severity);
    legacyTypes.push(warning.type);
    details.push({ ...warning, severity });
  }

  return { legacyTypes, details };
}

function isSafeDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function toKigaliClock(date: Date): KigaliClock {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: KIGALI_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = Number.parseInt(map.hour ?? "0", 10);
  const minute = Number.parseInt(map.minute ?? "0", 10);
  const month = Number.parseInt(map.month ?? "1", 10);
  const year = Number.parseInt(map.year ?? "1970", 10);
  const day = Number.parseInt(map.day ?? "1", 10);

  const safeMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : 1;
  const safeDay = Number.isFinite(day) && day >= 1 && day <= 31 ? day : 1;
  const safeYear = Number.isFinite(year) ? year : 1970;

  const dateLabel = `${map.year ?? "1970"}-${map.month ?? "01"}-${map.day ?? "01"}`;

  const dateValue = Date.UTC(safeYear, safeMonth - 1, safeDay);

  return {
    minutesFromMidnight: hour * 60 + minute,
    label: `${map.hour ?? "00"}:${map.minute ?? "00"}`,
    month: safeMonth,
    dateLabel,
    dateValue,
  };
}

function getSunEvents(month: number): SunEvents {
  return KIGALI_SUN_EVENTS[month] ?? DEFAULT_SUN_EVENTS;
}

function minutesToLabel(minutes: number): string {
  const safeMinutes = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const hour = Math.floor(safeMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minute = (safeMinutes % 60).toString().padStart(2, "0");
  return `${hour}:${minute}`;
}

function isNightTravel(clock: KigaliClock, events: SunEvents): boolean {
  return (
    clock.minutesFromMidnight < events.sunriseMinutes ||
    clock.minutesFromMidnight >= events.sunsetMinutes
  );
}

function isLateArrival(clock: KigaliClock, events: SunEvents): boolean {
  return clock.minutesFromMidnight >= events.sunsetMinutes + 60;
}

function isBeforeSunrise(clock: KigaliClock, events: SunEvents): boolean {
  return clock.minutesFromMidnight < events.sunriseMinutes;
}

function normalizeSeverity(severity: unknown): WarningSeverity {
  if (severity === "low" || severity === "medium" || severity === "high") {
    return severity;
  }
  if (severity === "critical") return "critical";
  return "medium";
}
