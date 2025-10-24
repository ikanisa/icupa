import { z } from "zod";

export const OptimizerDay = z.object({
  id: z.string().min(1, "day id required"),
  label: z.string().min(1, "day label required"),
  date: z.string().optional(),
  notes: z.string().optional(),
});

export const OptimizerAnchor = z.object({
  id: z.string().min(1, "anchor id required"),
  day_id: z.string().min(1, "anchor day id required"),
  label: z.string().min(1, "anchor label required"),
  start_minute: z.number().int().min(0).max(24 * 60).optional(),
  end_minute: z.number().int().min(0).max(24 * 60).optional(),
  window_id: z.string().min(1).optional(),
  locked: z.boolean().optional(),
  rationale: z.string().optional(),
});

export const OptimizerWindow = z.object({
  id: z.string().min(1, "window id required"),
  day_id: z.string().min(1, "window day id required"),
  start_minute: z.number().int().min(0).max(24 * 60),
  end_minute: z.number().int().min(0).max(24 * 60),
  label: z.string().optional(),
});

export const OptimizerInput = z.object({
  days: z.array(OptimizerDay).min(1),
  anchors: z.array(OptimizerAnchor),
  windows: z.array(OptimizerWindow),
  max_drive_minutes: z.number().int().min(0),
  pace: z.enum(["relaxed", "balanced", "ambitious"]),
});

export type OptimizerDay = z.infer<typeof OptimizerDay>;
export type OptimizerAnchor = z.infer<typeof OptimizerAnchor>;
export type OptimizerWindow = z.infer<typeof OptimizerWindow>;
export type OptimizerInput = z.infer<typeof OptimizerInput>;
