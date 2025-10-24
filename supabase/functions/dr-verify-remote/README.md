# dr-verify-remote

Supabase Edge Function stub that compares local and remote DR snapshot manifests. The handler ships with fixture responses so Ops can exercise the diff logic without contacting production buckets.

## Endpoints

- `POST /` — Compare manifests and return a diff summary.
- `GET /health` — Lightweight readiness probe returning `{ "ok": true }`.

## Request Payload

```json
{
  "local_manifest_url": "https://primary.example.com/snapshots/manifest.json",
  "remote_manifest_url": "https://standby.example.com/snapshots/manifest.json",
  "remote_health_url": "https://standby.example.com/health",
  "useFixtures": true
}
```

- When `useFixtures` is omitted or `true`, the function returns the bundled fixtures instead of performing network I/O.
- Set `useFixtures` to `false` to fetch real manifests from the provided URLs (expects JSON payloads that mirror the fixture schema).
- When fixtures are disabled all URL fields are required; the function returns `invalid_input` if any are missing.

## Fixture Diff Output

Calling the function with the default fixtures returns the following diff payload:

```json
{
  "ok": true,
  "request_id": "1a4d210f-c026-4e69-871e-76fc147b3813",
  "manifests": {
    "local": {
      "snapshot_id": "snap-local-2024-09-15",
      "label": "daily-dr",
      "generated_at": "2024-09-15T02:15:00.000Z",
      "source": "fixture",
      "url": null
    },
    "remote": {
      "snapshot_id": "snap-remote-2024-09-15",
      "label": "daily-dr",
      "generated_at": "2024-09-15T02:20:30.000Z",
      "source": "fixture",
      "url": null
    }
  },
  "diff": {
    "summary": {
      "tables_checked": 5,
      "missing_in_remote": 1,
      "missing_in_local": 1,
      "mismatched": 1,
      "matches": 2
    },
    "tables": {
      "core.profiles": {
        "status": "match",
        "local": { "rows": 1285, "checksum": "8b2137a8" },
        "remote": { "rows": 1285, "checksum": "8b2137a8" }
      },
      "booking.itineraries": {
        "status": "match",
        "local": { "rows": 452, "checksum": "bb12c77d" },
        "remote": { "rows": 452, "checksum": "bb12c77d" }
      },
      "booking.items": {
        "status": "missing_remote",
        "local": { "rows": 1984, "checksum": "b7719f10" }
      },
      "group.escrows": {
        "status": "missing_local",
        "remote": { "rows": 112, "checksum": "5c1a8001" }
      },
      "payment.payments": {
        "status": "mismatch",
        "local": { "rows": 342, "checksum": "9dd66351" },
        "remote": { "rows": 341, "checksum": "4aa901ce" },
        "differences": {
          "rows": { "local": 342, "remote": 341 },
          "checksum": { "local": "9dd66351", "remote": "4aa901ce" }
        }
      }
    },
    "metadata": {
      "summary": {
        "fields_checked": 3,
        "mismatched": 2,
        "matches": 1
      },
      "fields": {
        "snapshot_id": {
          "status": "mismatch",
          "local": "snap-local-2024-09-15",
          "remote": "snap-remote-2024-09-15"
        },
        "label": {
          "status": "match",
          "local": "daily-dr",
          "remote": "daily-dr"
        },
        "generated_at": {
          "status": "mismatch",
          "local": "2024-09-15T02:15:00.000Z",
          "remote": "2024-09-15T02:20:30.000Z"
        }
      }
    }
  },
  "remote_health": {
    "ok": true,
    "region": "eu-central-1",
    "last_snapshot_id": "snap-remote-2024-09-15",
    "source": "fixture"
  }
}
```

The sample demonstrates each diff bucket:

- `booking.items` is absent from the remote manifest → `missing_remote`.
- `group.escrows` only exists in the remote manifest → `missing_local`.
- `payment.payments` exists in both manifests but row counts and checksums differ → `mismatch`.
- Tables with identical stats (`core.profiles`, `booking.itineraries`) surface as `match` entries.
- Metadata mismatches (snapshot ID or generated timestamp) are surfaced under `diff.metadata`, helping operators confirm they are comparing the intended snapshot pair.

Use the `summary` section to drive runbook decisions (for example, fail the geo redundancy check if any counters besides `matches` are non-zero).
