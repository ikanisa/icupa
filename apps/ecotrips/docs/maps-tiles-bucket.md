# `maps_tiles` Supabase Storage Bucket

The `maps_tiles` bucket stores offline map packs that the client and wallet
surfaces can download for disconnected navigation. Objects are organised by
geography and version so that Vercel previews, staging, and production can point
at the same canonical fixtures while still allowing staged rollouts.

```
maps_tiles/
  {slug}/
    {yyyymmdd}/
      manifest.json          # High level metadata for the pack
      tiles.mbtiles          # Raster/vector tile archive
      media/
        preview.png          # Optional preview used in marketing surfaces
        legend.png           # Optional legend overlay
```

Key conventions:

- **Slug:** short, kebab-case identifier (for example `kigali-city-core`). The
  slug is repeated in API responses and UI copy so that operators can correlate
  downloads with the on-disk layout.
- **Version folder (`yyyymmdd`):** stamped when the tiles were built. Clients
  can compare this to `updated_at` in the metadata payload to decide whether to
  invalidate cached bundles.
- **manifest.json:** contains the same shape returned by the
  `maps-tiles-list` edge function (see below). The manifest is optional in local
  development but should be committed for production bundles.
- **tiles.mbtiles:** compressed SQLite archive of the tiles. The wallet UI uses
  the reported byte size from metadata to show progress indicators.
- **media assets:** preview art or legends rendered inside marketing and ops
  consoles. They follow the same public/private rules as the bundle itself.

## Access patterns

- **Edge functions:** `maps-tiles-list` reads fixture metadata and emits the
  storage path so that the client can request a signed URL on demand.
- **Supabase console:** Operators can upload updated packs directly via the
  Supabase Storage UI as long as the structure above is preserved.
- **CI deployments:** long lived packs should be uploaded once and then referenced
  by slug+version in configuration; short lived previews can use ephemeral
  versions that are automatically pruned.

Refer to `ops/CHAOS_INJECT.md` for guidance on disabling tile downloads while
running chaos exercises.
