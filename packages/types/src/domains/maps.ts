import { z } from "zod";

export const MapTileLayer = z.object({
  id: z.string(),
  kind: z.string(),
  size_bytes: z.number().int().nonnegative(),
});

export type MapTileLayer = z.infer<typeof MapTileLayer>;

export const MapTileCoverage = z.object({
  center: z.object({ lat: z.number(), lng: z.number() }),
  radius_km: z.number().nonnegative(),
  bounding_box: z.object({
    north: z.number(),
    south: z.number(),
    east: z.number(),
    west: z.number(),
  }),
});

export type MapTileCoverage = z.infer<typeof MapTileCoverage>;

export const MapTilePack = z.object({
  id: z.string(),
  slug: z.string(),
  region: z.string(),
  title: z.string(),
  description: z.string(),
  updated_at: z.string(),
  tiles: z.number().int().nonnegative(),
  bundle_bytes: z.number().int().nonnegative(),
  offline_zip_bytes: z.number().int().nonnegative(),
  storage_path: z.string(),
  manifest_path: z.string().nullable(),
  preview_url: z.string().url().nullable(),
  checksum_sha256: z.string().nullable(),
  languages: z.array(z.string()).default([]),
  coverage: MapTileCoverage,
  offline_layers: z.array(MapTileLayer).default([]),
  notes: z.string().nullable(),
  recommended_app_version: z.string().nullable(),
});

export type MapTilePack = z.infer<typeof MapTilePack>;

export const MapsTilesListInput = z.object({
  region: z.string().optional(),
  include_experimental: z.boolean().optional(),
});

export type MapsTilesListInput = z.infer<typeof MapsTilesListInput>;

export const MapsTilesListResponse = z.object({
  ok: z.literal(true),
  request_id: z.string(),
  source: z.enum(["fixtures", "database", "mixed", "memory"]).default("fixtures"),
  generated_at: z.string(),
  packs: z.array(MapTilePack),
});

export type MapsTilesListResponse = z.infer<typeof MapsTilesListResponse>;
