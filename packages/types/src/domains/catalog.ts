import { z } from "zod";

export const SearchMatchDescriptor = z.object({
  field: z.string(),
  terms: z.array(z.string()).default([]),
});

export const SearchPlace = z.object({
  slug: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  keywords: z.array(z.string()),
  metadata: z.record(z.any()),
  score: z.number().min(0),
  matches: z.array(SearchMatchDescriptor).default([]),
});

export type SearchPlace = z.infer<typeof SearchPlace>;

export const SearchPlacesInput = z.object({
  query: z
    .string()
    .min(2, "query_too_short")
    .max(120, "query_too_long"),
  limit: z.number().int().min(1).max(12).optional(),
});

export type SearchPlacesInput = z.infer<typeof SearchPlacesInput>;

export const SearchPlacesResponse = z.object({
  ok: z.boolean(),
  requestId: z.string().optional(),
  query: z.string(),
  items: z.array(SearchPlace),
  source: z.enum(["catalog", "fixtures"]),
  fallback: z.boolean().optional(),
});

export type SearchPlacesResponse = z.infer<typeof SearchPlacesResponse>;
