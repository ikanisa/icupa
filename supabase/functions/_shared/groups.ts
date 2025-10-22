import { ERROR_CODES } from "./constants.ts";
import { getSupabaseServiceConfig } from "./env.ts";

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } =
  getSupabaseServiceConfig({ feature: "groups" });

const PUBLIC_HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Accept-Profile": "public",
} as const;

const GROUP_HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Accept-Profile": "group",
  "Content-Profile": "group",
} as const;

const RPC_HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  "Accept-Profile": "public",
  Prefer: "params=single-object",
} as const;

export interface GroupAuthInfo {
  userId: string | null;
  isOps: boolean;
  actorLabel: string;
}

export interface GroupEscrowRow {
  id: string;
  group_id: string;
  itinerary_id: string | null;
  currency: string;
  target_cents: number;
  min_members: number;
  deadline: string;
  status: string;
}

export interface GroupMembershipRow {
  id: string;
  group_id: string;
  user_id: string | null;
  role: string;
}

export type GroupAuditLogger = (fields: Record<string, unknown>) => void;

export function createGroupAuditLogger(
  fn: string,
  event: string,
): GroupAuditLogger {
  return (fields) => {
    console.log(
      JSON.stringify({
        level: "AUDIT",
        event,
        fn,
        ...fields,
      }),
    );
  };
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

interface ResolveAuthOptions {
  includePersona?: boolean;
}

export async function resolveGroupAuth(
  req: Request,
  options: ResolveAuthOptions = {},
): Promise<GroupAuthInfo> {
  const authHeader = req.headers.get("authorization") ??
    req.headers.get("Authorization") ?? "";

  if (!authHeader) {
    return { userId: null, isOps: false, actorLabel: "anonymous" };
  }

  if (authHeader === `Bearer ${SERVICE_ROLE_KEY}`) {
    return { userId: null, isOps: true, actorLabel: "service-role" };
  }

  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: authHeader,
      },
    });

    if (!userRes.ok) {
      return { userId: null, isOps: false, actorLabel: "unauthorized" };
    }

    const payload = await userRes.json() as { id?: string };
    const userId = typeof payload?.id === "string" ? payload.id : null;
    if (!userId) {
      return { userId: null, isOps: false, actorLabel: "unauthorized" };
    }

    let isOps = false;
    if (options.includePersona) {
      try {
        const profileRes = await fetch(
          `${SUPABASE_URL}/rest/v1/core.profiles?select=persona&auth_user_id=eq.${userId}&limit=1`,
          {
            headers: PUBLIC_HEADERS,
          },
        );
        if (profileRes.ok) {
          const rows = await profileRes.json();
          if (Array.isArray(rows) && rows[0]?.persona === "ops") {
            isOps = true;
          }
        }
      } catch (_error) {
        // ignore profile lookup failures, auth still succeeds
      }
    }

    return { userId, isOps, actorLabel: userId };
  } catch (_error) {
    return { userId: null, isOps: false, actorLabel: "unknown" };
  }
}

export async function fetchGroupEscrow(
  escrowId: string,
): Promise<GroupEscrowRow | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/group_escrows_view?select=id,group_id,itinerary_id,currency,target_cents,min_members,deadline,status&limit=1&id=eq.${escrowId}`,
    {
      headers: PUBLIC_HEADERS,
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to load escrow: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    return null;
  }
  return rows[0] as GroupEscrowRow;
}

export async function fetchGroupMembershipByUser(
  groupId: string,
  userId: string,
): Promise<GroupMembershipRow | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/group_members_view?select=id,group_id,user_id,role&limit=1&group_id=eq.${groupId}&user_id=eq.${userId}`,
    {
      headers: PUBLIC_HEADERS,
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to load membership: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    return null;
  }
  return rows[0] as GroupMembershipRow;
}

export async function fetchGroupMembershipById(
  memberId: string,
): Promise<GroupMembershipRow | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/group_members_view?select=id,group_id,user_id,role&limit=1&id=eq.${memberId}`,
    {
      headers: PUBLIC_HEADERS,
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to load membership by id: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    return null;
  }
  return rows[0] as GroupMembershipRow;
}

export async function insertGroupMembership(
  groupId: string,
  userId: string,
  role: string,
): Promise<{ id: string; role: string }> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/create_group_membership`,
    {
      method: "POST",
      headers: RPC_HEADERS,
      body: JSON.stringify({
        p_group: groupId,
        p_user: userId,
        p_role: role,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to insert membership: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
    throw error;
  }

  const data = await response.json();
  if (!data?.id) {
    throw new Error("Unexpected membership insert response");
  }
  return data as { id: string; role: string };
}

export async function insertGroupContribution(
  payload: Record<string, unknown>,
): Promise<{ id: string }> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/insert_group_contribution`,
    {
      method: "POST",
      headers: RPC_HEADERS,
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to insert contribution: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
    throw error;
  }

  const data = await response.json();
  if (!data?.id) {
    throw new Error("Unexpected contribution insert response");
  }
  return data as { id: string };
}

export async function fetchGroupContributionSummary(
  escrowId: string,
): Promise<{ total: number; memberCount: number }> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/group_contribution_summary`,
    {
      method: "POST",
      headers: RPC_HEADERS,
      body: JSON.stringify({ p_escrow: escrowId }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to summarize contributions: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  const data = await response.json();
  return {
    total: Number(data?.total ?? 0),
    memberCount: Number(data?.member_count ?? 0),
  };
}

export async function updateGroupEscrowStatus(
  escrowId: string,
  status: string,
): Promise<void> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/escrows?id=eq.${escrowId}`,
    {
      method: "PATCH",
      headers: {
        ...GROUP_HEADERS,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ status }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to update escrow status: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
    throw error;
  }
}

export async function ensureGroupPaymentRecord(
  itineraryId: string | null,
  amount: number,
  currency: string,
  idempotency: string,
): Promise<string> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/ensure_payment_record`,
    {
      method: "POST",
      headers: RPC_HEADERS,
      body: JSON.stringify({
        p_itinerary: itineraryId,
        p_amount_cents: amount,
        p_currency: currency,
        p_idempotency: idempotency,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to create payment record: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
    throw error;
  }

  const data = await response.json();
  if (typeof data !== "string") {
    throw new Error("Unexpected payment record response");
  }
  return data;
}

export async function insertGroupEscrow(
  payload: Record<string, unknown>,
): Promise<{ id: string; status?: string }> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/create_group_escrow`,
    {
      method: "POST",
      headers: RPC_HEADERS,
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to create escrow: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
    throw error;
  }

  const data = await response.json();
  if (!data?.id) {
    throw new Error("Unexpected response from create_group_escrow");
  }
  return data as { id: string; status?: string };
}
