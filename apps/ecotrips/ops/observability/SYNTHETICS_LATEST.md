# Synthetics Probe Run (local mock)

- **Command:** `SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=test deno run -A supabase/functions/synthetics-probe/index.ts`
- **Invocation:** `curl -s http://127.0.0.1:8000`
- **Result:** All 19 targets returned `200 OK` from the mock Supabase server (overall availability `1.0`).

```json
{
  "ok": true,
  "ts": "2025-10-23T22:59:21.557Z",
  "request_id": "ca9a7fc5-e838-477b-a9ff-5bbfe9fb3292",
  "ok_count": 19,
  "fail_count": 0,
  "critical_fail_count": 0,
  "availability": 1,
  "category_breakdown": {
    "bff": { "ok": 2, "total": 2, "availability": 1 },
    "inventory": { "ok": 3, "total": 3, "availability": 1 },
    "agents": { "ok": 1, "total": 1, "availability": 1 },
    "groups": { "ok": 3, "total": 3, "availability": 1 },
    "maps": { "ok": 2, "total": 2, "availability": 1 },
    "ops": { "ok": 3, "total": 3, "availability": 1 },
    "messaging": { "ok": 1, "total": 1, "availability": 1 },
    "observability": { "ok": 1, "total": 1, "availability": 1 },
    "privacy": { "ok": 1, "total": 1, "availability": 1 },
    "permits": { "ok": 1, "total": 1, "availability": 1 },
    "payments": { "ok": 1, "total": 1, "availability": 1 }
  }
}
```

> The mock service returns instant health responses, exercising the expanded target list (`groups-join`, `groups-contribute`, `map-route`, `map-nearby`, `ops-*`, `permits-request`). For live telemetry, rerun against production Supabase credentials.
