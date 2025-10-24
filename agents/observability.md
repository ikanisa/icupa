# Agent Observability

This playbook captures how the agent stack emits telemetry while honoring user privacy.

## Tool span events

* Every successful tool invocation now writes a secondary `agents.events` row with `event = "agent.tool_span"` and payload:
  ```json
  {
    "agent": "PlannerCoPilot",
    "tool_key": "quote.search",
    "request_id": "f5c1f7c2-4d28-4eb1-bb11-3f1d4eb31fb8",
    "start_ms": 1733421925123,
    "duration_ms": 842,
    "status": 200,
    "ok": true,
    "hashes": {
      "request": "2f0380c72c2dcda0ca502f4dfbf87d62f4e4af63f4e53d20a35978d9cf0ba80c",
      "response": "fb8667855d8dd23461337609ab6ad66df3c6a7f1242449fa555c0f5e6d926121"
    },
    "token_counts": { "request": 98, "response": 143 },
    "byte_counts": { "request": 612, "response": 894 },
    "privacy": { "raw_content": false, "hashing": "sha256" }
  }
  ```
* Failures emit the same shape with `ok: false` and an `error` hash so we can correlate retries without revealing payloads.
* These span rows augment (do not replace) the existing `agent.tool_call` AUDIT event, preserving compatibility for dashboards.

## Hashing strategy

* Prompts, tool requests, completions, and structured error payloads are converted to canonical JSON (or trimmed text) prior to hashing.
* We use SHA-256 via the platform `crypto.subtle` API and store only hexadecimal digests. No raw content is persisted.
* Byte and approximate token counts accompany each hash so we can reason about payload sizes without inspecting user text.

## Token counting heuristics

* Tokens are approximated by counting word and punctuation boundaries (`/\w+|[^\s]/g`).
* The heuristic is deterministic and lightweight; it avoids bundling tokenizer dependencies into edge functions.
* When precise accounting is required (e.g., LLM billing), run the Supabase analytical job with full tokenizers—span rows provide correlation IDs for sampling.

## Privacy constraints

* Raw prompts, completions, and tool inputs **must never** be written to `agents.events`.
* Span payloads include a `privacy` block that documents the hashing algorithm so reviewers can validate compliance.
* When debugging is necessary, engineers should reproduce requests locally with redacted fixtures rather than inspecting production payloads.

## Post-deployment verification

After deploying to Supabase, run the `tools/tests/observability.mjs` script or inspect recent `agent.tool_span` events to confirm coverage. Example output:

```
agent.tool_span PlannerCoPilot quote.search ok duration=842ms hashes.request=2f0380...
agent.tool_span PlannerCoPilot quote.search error duration=913ms hashes.error=ab12ce...
```

These lines demonstrate that spans are flowing with hashed artifacts, proving observability without leaking customer data.
