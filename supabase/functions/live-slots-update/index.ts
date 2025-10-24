import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import {
  createGroupAuditLogger,
  fetchGroupContributionSummary,
  fetchGroupEscrow,
  fetchGroupEscrowsByGroup,
  fetchGroupEscrowsByItinerary,
  fetchGroupMembershipByUser,
  GroupEscrowRow,
  GroupLiveSlotsUpsertInput,
  jsonResponse,
  resolveGroupAuth,
  upsertGroupLiveSlots,
} from "../_shared/groups.ts";
import { getSupabaseServiceConfig } from "../_shared/env.ts";

const audit = createGroupAuditLogger(
  "live-slots-update",
  "groups.live_slots.update",
);

const REALTIME_CHANNEL = "group-live-slots";

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } =
  getSupabaseServiceConfig({ feature: "live-slots" });

const PRESENCE_HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Accept-Profile": "concierge",
} as const;

interface PresenceRow {
  is_opted_in: boolean | null;
  visible: boolean | null;
  status: string | null;
}

interface PresenceStats {
  total: number;
  optIn: number;
  visible: number;
  online: number;
}

async function fetchPresenceStats(groupId: string): Promise<PresenceStats> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/concierge.presence?select=is_opted_in,visible,status&group_id=eq.${groupId}`,
    { headers: PRESENCE_HEADERS },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to load presence: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) {
    return { total: 0, optIn: 0, visible: 0, online: 0 };
  }

  let optIn = 0;
  let visible = 0;
  let online = 0;

  for (const raw of rows as PresenceRow[]) {
    if (raw.is_opted_in) {
      optIn += 1;
      if (raw.visible) {
        visible += 1;
        if ((raw.status ?? "") === "online") {
          online += 1;
        }
      }
    }
  }

  return {
    total: (rows as PresenceRow[]).length,
    optIn,
    visible,
    online,
  };
}

interface ParsedRequest {
  groupId: string | null;
  escrowId: string | null;
  itineraryId: string | null;
}

function parseRequestBody(body: Record<string, unknown>): ParsedRequest {
  const groupId = typeof body?.group_id === "string" ? body.group_id : null;
  const escrowId = typeof body?.escrow_id === "string" ? body.escrow_id : null;
  const itineraryId = typeof body?.itinerary_id === "string"
    ? body.itinerary_id
    : null;
  return { groupId, escrowId, itineraryId };
}

async function buildLiveSlotEntry(
  escrow: GroupEscrowRow,
  presence: PresenceStats,
): Promise<GroupLiveSlotsUpsertInput> {
  const summary = await fetchGroupContributionSummary(escrow.id);
  const totalSlots = escrow.min_members;
  const filledSlots = summary.memberCount;
  const availableSlots = Math.max(totalSlots - filledSlots, 0);
  const waitlistSlots = Math.max(filledSlots - totalSlots, 0);

  return {
    escrowId: escrow.id,
    groupId: escrow.group_id,
    itineraryId: escrow.itinerary_id,
    totalSlots,
    filledSlots,
    availableSlots,
    waitlistSlots,
    presenceOptIn: presence.optIn,
    presenceVisible: presence.visible,
    presenceOnline: presence.online,
    visible: presence.optIn > 0,
  };
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("live-slots-update");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, { status: 405 });
  }

  const auth = await resolveGroupAuth(req, { includePersona: true });

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { groupId, escrowId, itineraryId } = parseRequestBody(payload ?? {});
  if (!groupId && !escrowId && !itineraryId) {
    return jsonResponse({
      ok: false,
      error: "Provide group_id, escrow_id, or itinerary_id",
    }, { status: 400 });
  }

  try {
    let escrows: GroupEscrowRow[] = [];
    let resolvedGroupId = groupId;

    if (escrowId) {
      const escrow = await fetchGroupEscrow(escrowId);
      if (!escrow) {
        return jsonResponse({ ok: false, error: "Escrow not found" }, { status: 404 });
      }
      escrows = [escrow];
      resolvedGroupId = escrow.group_id;
    } else if (groupId) {
      escrows = await fetchGroupEscrowsByGroup(groupId);
    } else if (itineraryId) {
      escrows = await fetchGroupEscrowsByItinerary(itineraryId);
      if (escrows[0]) {
        resolvedGroupId = escrows[0].group_id;
      }
    }

    if (!resolvedGroupId) {
      return jsonResponse({ ok: false, error: "Group not found" }, { status: 404 });
    }

    if (!auth.isOps) {
      if (!auth.userId) {
        return jsonResponse({ ok: false, error: "Authentication required" }, { status: 401 });
      }
      const membership = await fetchGroupMembershipByUser(resolvedGroupId, auth.userId);
      if (!membership) {
        return jsonResponse({ ok: false, error: "Membership required" }, { status: 403 });
      }
    }

    if (!escrows.length) {
      return jsonResponse({ ok: false, error: "No escrows to update" }, { status: 404 });
    }

    const presence = await fetchPresenceStats(resolvedGroupId);
    const entries: GroupLiveSlotsUpsertInput[] = [];

    for (const escrow of escrows) {
      const entry = await buildLiveSlotEntry(escrow, presence);
      entries.push(entry);
    }

    await upsertGroupLiveSlots(entries);

    audit({
      requestId,
      actor: auth.actorLabel,
      group: resolvedGroupId,
      escrows: entries.map((entry) => entry.escrowId),
      channel: REALTIME_CHANNEL,
      presence_opt_in: presence.optIn,
      presence_visible: presence.visible,
      presence_online: presence.online,
    });

    return jsonResponse({
      ok: true,
      group_id: resolvedGroupId,
      updated: entries.length,
      channel: REALTIME_CHANNEL,
      rows: entries,
    });
  } catch (error) {
    const wrapped = error instanceof Error ? error : new Error(String(error));
    audit({ requestId, actor: auth.actorLabel, status: "error", error: wrapped.message });
    (wrapped as { code?: string }).code ??= ERROR_CODES.UNKNOWN;
    throw wrapped;
  }
}, { fn: "live-slots-update", defaultErrorCode: ERROR_CODES.UNKNOWN });

serve(handler);
