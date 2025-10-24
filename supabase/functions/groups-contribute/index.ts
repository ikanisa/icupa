import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import {
  createGroupAuditLogger,
  ensureGroupPaymentRecord,
  fetchGroupContributionSummary,
  fetchGroupEscrow,
  fetchGroupMembershipById,
  fetchGroupMembershipByUser,
  GroupMembershipRow,
  jsonResponse,
  resolveGroupAuth,
  updateGroupEscrowStatus,
  insertGroupContribution,
} from "../_shared/groups.ts";

const audit = createGroupAuditLogger("groups-contribute", "groups.contribute");

async function deriveIdempotencyKey(parts: string[]): Promise<string> {
  const input = new TextEncoder().encode(parts.join(":"));
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 48);
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("groups-contribute");
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

  const escrowId = typeof body?.escrow_id === "string" ? body.escrow_id : "";
  const amountCents = Number(body?.amount_cents);
  const currencyOverride = typeof body?.currency === "string"
    ? body.currency.toUpperCase()
    : null;
  const overrideUserId = typeof body?.user_id === "string"
    ? body.user_id
    : null;
  const overrideMemberId = typeof body?.member_id === "string"
    ? body.member_id
    : null;

  if (!escrowId || !/^[0-9a-fA-F-]{36}$/.test(escrowId)) {
    return jsonResponse({ ok: false, error: "escrow_id must be a UUID" }, {
      status: 400,
    });
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return jsonResponse({
      ok: false,
      error: "amount_cents must be a positive integer",
    }, { status: 400 });
  }

  let actingUserId = auth.userId;
  if (!actingUserId && auth.isOps && overrideUserId) {
    actingUserId = overrideUserId;
  }

  try {
    const escrow = await fetchEscrow(escrowId);
    if (!escrow) {
      return jsonResponse({ ok: false, error: "Escrow not found" }, {
        status: 404,
      });
    }

    const currency = currencyOverride ?? escrow.currency;
    if (currency !== escrow.currency) {
      return jsonResponse({ ok: false, error: "currency must match escrow" }, {
        status: 400,
      });
    }

    let membership: GroupMembershipRow | null = null;
    if (overrideMemberId && auth.isOps) {
      membership = await fetchMembershipById(overrideMemberId);
    } else if (actingUserId) {
      membership = await fetchMembershipByUser(escrow.group_id, actingUserId);
    }

    if (!membership) {
      return jsonResponse({ ok: false, error: "Membership required" }, {
        status: 403,
      });
    }

    const idempotency = await deriveIdempotencyKey([
      membership.id,
      escrow.id,
      amountCents.toString(),
      currency,
    ]);

    const paymentId = await ensureGroupPaymentRecord(
      escrow.itinerary_id,
      amountCents,
      currency,
      idempotency,
    );

    const contribution = await insertGroupContribution({
      p_escrow: escrow.id,
      p_member: membership.id,
      p_amount: amountCents,
      p_currency: currency,
      p_payment: paymentId,
    });

    const summary = await fetchGroupContributionSummary(escrow.id);
    let nextStatus = escrow.status;
    const now = Date.now();
    const deadlineMs = new Date(escrow.deadline).getTime();
    const goalMet = summary.total >= escrow.target_cents &&
      summary.memberCount >= escrow.min_members;

    if (goalMet && escrow.status !== "paid_out") {
      nextStatus = "met";
    } else if (!goalMet && deadlineMs < now && escrow.status === "open") {
      nextStatus = "expired";
    }

    if (nextStatus !== escrow.status) {
      await updateEscrowStatus(escrow.id, nextStatus);
    }

    audit({
      requestId,
      actor: auth.actorLabel,
      escrow: escrow.id,
      member: membership.id,
      amount: amountCents,
      currency,
      nextStatus,
    });

    return jsonResponse({
      ok: true,
      contribution_id: contribution.id,
      payment_id: paymentId,
      escrow_status: nextStatus,
    });
  } catch (error) {
    audit({
      requestId,
      actor: auth.actorLabel,
      escrow: escrowId,
      status: "error",
    });
    const wrapped = error instanceof Error ? error : new Error(String(error));
    (wrapped as { code?: string }).code ??= ERROR_CODES.UNKNOWN;
    throw wrapped;
  }
}, { fn: "groups-contribute", defaultErrorCode: ERROR_CODES.UNKNOWN });

serve(handler);
