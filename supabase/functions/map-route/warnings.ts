export const RWANDA_TIMEZONE = "Africa/Kigali";

function getHourInTimeZone(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone,
  });
  const parts = formatter.formatToParts(date);
  const hourPart = parts.find((part) => part.type === "hour");
  const hour = hourPart ? Number.parseInt(hourPart.value, 10) : Number.NaN;
  if (Number.isNaN(hour)) {
    return date.getUTCHours();
  }
  return hour;
}

export function buildWarnings(start: Date, end: Date): string[] {
  const warnings: string[] = [];
  const departureHour = getHourInTimeZone(start, RWANDA_TIMEZONE);
  if (departureHour < 5 || departureHour >= 19) {
    warnings.push("night_travel");
  }
  const arrivalHour = getHourInTimeZone(end, RWANDA_TIMEZONE);
  if (arrivalHour >= 21 || arrivalHour < 6) {
    warnings.push("late_arrival_check_required");
  }
  return warnings;
}

export function isNightTravel(start: Date): boolean {
  const departureHour = getHourInTimeZone(start, RWANDA_TIMEZONE);
  return departureHour < 5 || departureHour >= 19;
}

export function requiresLateArrivalCheck(end: Date): boolean {
  const arrivalHour = getHourInTimeZone(end, RWANDA_TIMEZONE);
  return arrivalHour >= 21 || arrivalHour < 6;
}
