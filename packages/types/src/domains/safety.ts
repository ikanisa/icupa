import { z } from "zod";

export const RouteWarningSeverity = z.enum(["info", "watch", "alert"]);
export type RouteWarningSeverity = z.infer<typeof RouteWarningSeverity>;

export const RouteWarningCode = z.enum([
  "night_travel",
  "late_arrival_check_required",
  "weather_alert",
]);
export type RouteWarningCode = z.infer<typeof RouteWarningCode>;

export const RouteAdvisory = z.object({
  code: z.string().min(1),
  audience: z.enum(["traveler", "ops", "safety"]).default("traveler"),
  headline: z.string().min(1),
  detail: z.string().min(1),
  actions: z.array(z.string().min(1)).default([]),
  effective_from: z.string().optional(),
  effective_to: z.string().optional(),
  tags: z.array(z.string().min(1)).default([]),
});
export type RouteAdvisory = z.infer<typeof RouteAdvisory>;

export const RouteWarning = z.object({
  code: RouteWarningCode,
  severity: RouteWarningSeverity,
  summary: z.string().min(1),
  detail: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  advisories: z.array(RouteAdvisory).default([]),
});
export type RouteWarning = z.infer<typeof RouteWarning>;

export const RouteSafetyDigest = z.object({
  request_id: z.string().min(1),
  warnings: z.array(RouteWarning).default([]),
  advisories: z.array(RouteAdvisory).default([]),
});
export type RouteSafetyDigest = z.infer<typeof RouteSafetyDigest>;
