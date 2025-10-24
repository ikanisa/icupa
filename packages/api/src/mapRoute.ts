import { RouteAdvisory, RouteSafetyDigest, RouteWarning } from "@ecotrips/types";
import { z } from "zod";

const RouteLeg = z.object({
  leg_id: z.string(),
  summary: z.string(),
  mode: z.string(),
  distance_meters: z.number(),
  duration_minutes: z.number(),
  start_time: z.string(),
  end_time: z.string(),
  notes: z.string().optional(),
});

const MapRouteResponse = z.object({
  ok: z.boolean(),
  request_id: z.string(),
  route: z.object({
    origin: z.string(),
    destination: z.string(),
    departure_time: z.string(),
    arrival_time: z.string(),
    total_minutes: z.number(),
    distance_meters: z.number(),
    warnings: z.array(z.string()).default([]),
    warning_details: z.array(RouteWarning).default([]),
    advisories: z.array(RouteAdvisory).default([]),
    legs: z.array(RouteLeg).default([]),
    source: z.string(),
  }),
});

export type MapRouteResponse = z.infer<typeof MapRouteResponse>;

export interface FetchRouteWarningsOptions {
  supabaseUrl: string;
  serviceRoleKey: string;
  payload: {
    origin: string;
    destination: string;
    departure_time?: string;
  };
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export async function fetchRouteWarnings(
  options: FetchRouteWarningsOptions,
): Promise<z.infer<typeof RouteSafetyDigest>> {
  const fetcher = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const signal = options.signal ?? controller.signal;
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const url = `${options.supabaseUrl.replace(/\/$/, "")}/functions/v1/map-route`;
    const response = await fetcher(url, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        apikey: options.serviceRoleKey,
        Authorization: `Bearer ${options.serviceRoleKey}`,
      },
      body: JSON.stringify(options.payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `map-route fetch failed with ${response.status}: ${text.slice(0, 2000)}`,
      );
    }

    const json = await response.json();
    const parsed = MapRouteResponse.parse(json);
    const advisories = parsed.route.advisories.length
      ? parsed.route.advisories
      : parsed.route.warning_details.flatMap((warning) => warning.advisories ?? []);

    return RouteSafetyDigest.parse({
      request_id: parsed.request_id,
      warnings: parsed.route.warning_details,
      advisories,
    });
  } finally {
    clearTimeout(timeout);
  }
}
