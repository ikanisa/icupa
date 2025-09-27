# Voice Waiter Readiness Checklist

This note captures technical and operational requirements for enabling the realtime voice waiter experience. Complete every item before launching a canary tenant.

## Platform prerequisites

1. **OpenAI Realtime credentials**: provision a project-level `OPENAI_REALTIME_API_KEY` and regional base URL; store in Supabase secrets (`VOICE_REALTIME_API_KEY`, `VOICE_REALTIME_BASE_URL`).
2. **WebRTC support**: confirm diner hardware meets WebRTC and microphone access (Chrome ≥125 / Safari 17+). Add a device check gate in the client app (`navigator.mediaDevices.getUserMedia`).
3. **Edge function token broker**: expose a Supabase Function that issues short-lived Realtime session tokens scoped to the table session (follow `docs/runbooks/ai-kill-switch.md` token pattern).
4. **Audio CDN**: cache assistant voice replies via edge storage to avoid re-synthesis on reconnection.

## Agent service configuration

- Set `VOICE_AGENT_ENABLED=true` in the agents service and configure:
  - `VOICE_AGENT_MODEL` (default `gpt-4o-realtime-preview`).
  - `VOICE_AGENT_LATENCY_BUDGET_MS=3500`.
  - `VOICE_AGENT_TRANSCRIPTION_MODEL` (fallback `gpt-4o-mini-transcribe`).
- Add tenant overrides in `agent_runtime_configs` for `voice_waiter` with session budget ≤$0.60 and daily ≤$25.
- Ensure traces export via OTLP (`OTEL_EXPORTER_OTLP_ENDPOINT`) for live latency charts.

## Client experience gates

- Display a preflight modal collecting microphone permission and presenting AI disclosure copy.
- Offer an accessible fallback (“Switch to text chat”) on every voice screen.
- Pause voice output when allergen guard blocks a recommendation.

## Operational rollout

- Pilot with 2 Malta venues and 1 Kigali venue (≤25 tables) for 7-day soak.
- Staff training: table-side voice etiquette and manual override path (link to `docs/runbooks/ai-kill-switch.md`).
- Monitor metrics in Grafana voice dashboard: `voice_latency_p95`, `voice_session_drop_rate`, `voice_guardrail_blocks`.
- Incident response: if drop rate ≥5% or latency ≥5s for 10 minutes, disable `VOICE_AGENT_ENABLED` and revert to text-only waiter.

Document sign-off by Engineering, Product, Operations, and Legal before enabling the flag for production tenants.
