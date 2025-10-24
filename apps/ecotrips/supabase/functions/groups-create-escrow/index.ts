import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import {
  createGroupAuditLogger,
  fetchGroupMembershipByUser,
  insertGroupEscrow,
  jsonResponse,
  resolveGroupAuth,
} from "../_shared/groups.ts";

const audit = createGroupAuditLogger("groups-create-escrow", "groups.create_escrow");

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("groups-create-escrow");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, { status: 405 });
  }

  const auth = await resolveGroupAuth(req, { includePersona: true });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, errors: ["Invalid JSON body"] }, {
      status: 400,
    });
  }

  const errors: string[] = [];
  const groupId = typeof body?.group_id === "string" ? body.group_id : "";
  const itineraryId = typeof body?.itinerary_id === "string"
    ? body.itinerary_id
    : null;
  const targetCents = Number(body?.target_cents);
  const minMembers = Number(body?.min_members ?? 2);
  const deadlineRaw = typeof body?.deadline === "string" ? body.deadline : "";
  const currency = typeof body?.currency === "string"
    ? body.currency.toUpperCase()
    : "USD";

  let actingUserId = auth.userId;
  if (!actingUserId && auth.isOps && typeof body?.user_id === "string") {
    actingUserId = body.user_id;
  }

  if (!groupId || !/^[0-9a-fA-F-]{36}$/.test(groupId)) {
    errors.push("group_id must be a UUID");
  }
  if (targetCents <= 0 || !Number.isInteger(targetCents)) {
    errors.push("target_cents must be a positive integer");
  }
  if (!Number.isInteger(minMembers) || minMembers < 1) {
    errors.push("min_members must be >= 1");
  }
  if (!deadlineRaw || Number.isNaN(new Date(deadlineRaw).getTime())) {
    errors.push("deadline must be ISO date-time");
  }
  if (!["USD", "EUR", "RWF"].includes(currency)) {
    errors.push("currency must be USD|EUR|RWF");
  }

  if (errors.length > 0) {
    return jsonResponse({ ok: false, errors }, { status: 400 });
  }

  if (!actingUserId && !auth.isOps) {
    return jsonResponse({ ok: false, error: "Authentication required" }, {
      status: 401,
    });
  }

  try {
    let ownerOk = auth.isOps;
    if (!ownerOk && actingUserId) {
      const membership = await fetchGroupMembershipByUser(groupId, actingUserId);
      ownerOk = !!membership && membership.role === "owner";
    }

    if (!ownerOk) {
      return jsonResponse({
        ok: false,
        error: "Only owners may create escrows",
      }, { status: 403 });
    }

    const deadline = new Date(deadlineRaw);
    if (deadline.getTime() <= Date.now()) {
      return jsonResponse({
        ok: false,
        error: "deadline must be in the future",
      }, { status: 400 });
    }

    const row = await insertGroupEscrow({
      p_group: groupId,
      p_itinerary: itineraryId,
      p_currency: currency,
      p_target: targetCents,
      p_min_members: minMembers,
      p_deadline: deadline.toISOString(),
    });

    audit({
      requestId,
      actor: auth.actorLabel,
      group: groupId,
      target: targetCents,
      currency,
    });

    return jsonResponse({ ok: true, escrow_id: row.id, status: row.status });
  } catch (error) {
    audit({ requestId, actor: auth.actorLabel, status: "error" });
    const wrapped = error instanceof Error ? error : new Error(String(error));
    (wrapped as { code?: string }).code ??= ERROR_CODES.UNKNOWN;
    throw wrapped;
  }
}, { fn: "groups-create-escrow", defaultErrorCode: ERROR_CODES.UNKNOWN });

serve(handler);
