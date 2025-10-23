import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import {
  createGroupAuditLogger,
  fetchGroupMembershipByUser,
  insertGroupMembership,
  jsonResponse,
  resolveGroupAuth,
} from "../_shared/groups.ts";

const audit = createGroupAuditLogger("groups-join", "groups.join");

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("groups-join");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, { status: 405 });
  }

  const auth = await resolveGroupAuth(req);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, errors: ["Invalid JSON body"] }, {
      status: 400,
    });
  }

  const groupId = typeof body?.group_id === "string" ? body.group_id : "";
  const overrideUserId = typeof body?.user_id === "string"
    ? body.user_id
    : null;
  const desiredRole = typeof body?.role === "string" ? body.role : "member";

  if (!groupId || !/^[0-9a-fA-F-]{36}$/.test(groupId)) {
    return jsonResponse({ ok: false, error: "group_id must be a UUID" }, {
      status: 400,
    });
  }

  let actingUserId = auth.userId;
  if (!actingUserId && auth.isOps && overrideUserId) {
    actingUserId = overrideUserId;
  }

  if (!actingUserId) {
    return jsonResponse({ ok: false, error: "Authentication required" }, {
      status: 401,
    });
  }

  try {
    const existing = await fetchGroupMembershipByUser(groupId, actingUserId);
    if (existing) {
      audit({
        requestId,
        actor: auth.actorLabel,
        group: groupId,
        member: existing.id,
        status: "existing",
      });
      return jsonResponse({
        ok: true,
        member_id: existing.id,
        role: existing.role,
      });
    }

    const inserted = await insertGroupMembership(
      groupId,
      actingUserId,
      desiredRole === "owner" ? "owner" : "member",
    );

    audit({
      requestId,
      actor: auth.actorLabel,
      group: groupId,
      member: inserted.id,
      status: "created",
    });

    return jsonResponse({
      ok: true,
      member_id: inserted.id,
      role: inserted.role,
    });
  } catch (error) {
    audit({
      requestId,
      actor: auth.actorLabel,
      group: groupId,
      status: "error",
    });
    const wrapped = error instanceof Error ? error : new Error(String(error));
    (wrapped as { code?: string }).code ??= ERROR_CODES.UNKNOWN;
    throw wrapped;
  }
}, { fn: "groups-join", defaultErrorCode: ERROR_CODES.UNKNOWN });

serve(handler);
