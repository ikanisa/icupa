import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import conflictsFixture from "./fixtures/conflicts.json" with { type: "json" };
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

interface OptimizerPayload {
  days?: unknown;
  anchors?: unknown;
  windows?: unknown;
  max_drive_minutes?: unknown;
  pace?: unknown;
}

interface ConflictRecord {
  id: string;
  day_id: string;
  anchor_ids: string[];
  severity: string;
  rationale: string;
  recommendation?: string;
}

const conflicts = (conflictsFixture as { conflicts: ConflictRecord[] }).conflicts;

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("conflict-resolver");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  let body: OptimizerPayload;
  try {
    body = (await req.json()) as OptimizerPayload;
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const validationErrors = validateOptimizerPayload(body);
  if (validationErrors.length > 0) {
    console.warn(
      JSON.stringify({
        level: "WARN",
        event: "optimizer.conflict.invalid_payload",
        fn: "conflict-resolver",
        requestId,
        errors: validationErrors,
      }),
    );
    return jsonResponse({ ok: false, errors: validationErrors }, 400);
  }

  for (const conflict of conflicts) {
    console.info(
      JSON.stringify({
        level: "INFO",
        event: "optimizer.conflict.rationale",
        fn: "conflict-resolver",
        requestId,
        conflict_id: conflict.id,
        day_id: conflict.day_id,
        severity: conflict.severity,
        rationale: conflict.rationale,
      }),
    );
  }

  return jsonResponse({
    ok: true,
    request_id: requestId,
    source: "fixtures",
    conflicts,
  });
}, { fn: "conflict-resolver", defaultErrorCode: ERROR_CODES.UNKNOWN });

serve(handler);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function validateOptimizerPayload(payload: OptimizerPayload): string[] {
  const errors: string[] = [];
  if (!Array.isArray(payload.days) || payload.days.length === 0) {
    errors.push("days must be a non-empty array");
  }
  if (!Array.isArray(payload.anchors)) {
    errors.push("anchors must be an array");
  }
  if (!Array.isArray(payload.windows)) {
    errors.push("windows must be an array");
  }
  if (typeof payload.max_drive_minutes !== "number") {
    errors.push("max_drive_minutes must be a number");
  }
  if (typeof payload.pace !== "string" || payload.pace.length === 0) {
    errors.push("pace must be a string");
  }
  return errors;
}
