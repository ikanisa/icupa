import {
  SAFETY_WARNING_TYPES,
  type SafetyWarning,
} from "./safety.ts";

export interface SafetyWarningCheck {
  id: string;
  description: string;
  request: {
    origin: string;
    destination: string;
    departure_time: string;
    arrival_time: string;
  };
  expectedWarnings: SafetyWarning[];
}

export const SAFETY_WARNING_CHECKS: SafetyWarningCheck[] = [
  {
    id: "night-travel-only",
    description:
      "Departure before sunrise should surface night travel safety notice.",
    request: {
      origin: "Station Alpha",
      destination: "Logistics Hub",
      departure_time: "2024-06-01T04:30:00.000Z",
      arrival_time: "2024-06-01T06:15:00.000Z",
    },
    expectedWarnings: ["night_travel"],
  },
  {
    id: "late-arrival-only",
    description:
      "Arrival past 21:00Z requires late arrival hand-off confirmation warning.",
    request: {
      origin: "Wetlands Staging",
      destination: "Research Outpost",
      departure_time: "2024-06-01T17:15:00.000Z",
      arrival_time: "2024-06-01T22:30:00.000Z",
    },
    expectedWarnings: ["late_arrival_check_required"],
  },
  {
    id: "night-and-late",
    description:
      "Evening departures that arrive after 21:00Z should flag both warnings.",
    request: {
      origin: "Central Depot",
      destination: "Remote Camp",
      departure_time: "2024-06-01T19:45:00.000Z",
      arrival_time: "2024-06-02T00:30:00.000Z",
    },
    expectedWarnings: [
      "night_travel",
      "late_arrival_check_required",
    ],
  },
];

export const MAP_ROUTE_HEALTH = {
  fn: "map-route",
  knownWarnings: SAFETY_WARNING_TYPES,
  safetyWarningChecks: SAFETY_WARNING_CHECKS,
} as const;

export function buildMapRouteHealthPayload(options?: { now?: Date }) {
  const now = options?.now ?? new Date();
  return {
    ok: true,
    fn: MAP_ROUTE_HEALTH.fn,
    time: now.toISOString(),
    knownWarnings: [...MAP_ROUTE_HEALTH.knownWarnings],
    safetyWarningChecks: MAP_ROUTE_HEALTH.safetyWarningChecks.map((check) => ({
      ...check,
      expectedWarnings: [...check.expectedWarnings],
    })),
  } as const;
}
