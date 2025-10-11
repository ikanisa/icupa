import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const ADMIN_INVITE_REDIRECT_URL = Deno.env.get("ADMIN_INVITE_REDIRECT_URL") ?? undefined;

const STAFF_ROLES = new Set(["owner", "admin", "manager", "cashier", "server", "chef", "kds", "auditor", "support"]);
const TENANT_MANAGEMENT_ROLES = new Set(["owner", "admin", "support"]);

interface ManageUserRoleRequest {
  action: "add" | "remove" | "list";
  tenantId?: string;
  email?: string;
  role?: string;
  userId?: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200, initHeaders?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      ...(initHeaders ?? {}),
    },
  });
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(value);
}

async function getRequestUser(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase configuration incomplete");
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return { user: null, error: new Error("Missing authorization header") };
  }

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  return { user, error };
}

async function ensureActorAuthorized(authClient: ReturnType<typeof createClient>, userId: string, tenantId: string) {
  const { data, error } = await authClient
    .from("user_roles")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to fetch actor roles", error);
    throw new Error("Authorization lookup failed");
  }

  if (!data || data.length === 0) {
    return false;
  }

  return data.some((row) => TENANT_MANAGEMENT_ROLES.has(row.role));
}

async function findOrInviteUser(
  adminClient: ReturnType<typeof createClient>,
  email: string,
): Promise<{ userId: string; invited: boolean }> {
  const lookup = await adminClient.auth.admin.getUserByEmail(email);
  if (lookup.data.user) {
    return { userId: lookup.data.user.id, invited: false };
  }

  if (lookup.error && lookup.error.message !== "User not found") {
    throw new Error(`Failed to lookup user: ${lookup.error.message}`);
  }

  const invite = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: ADMIN_INVITE_REDIRECT_URL,
  });

  if (invite.error || !invite.data.user) {
    const message = invite.error?.message ?? "Unable to invite user";
    throw new Error(message);
  }

  return { userId: invite.data.user.id, invited: true };
}

export async function handleManageUserRoles(req: Request): Promise<Response> {
  try {
    if (req.method === "OPTIONS") {
      return jsonResponse(
        {},
        200,
        {
          "access-control-allow-methods": "POST,OPTIONS",
          "access-control-allow-headers": "authorization,content-type",
        },
      );
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Only POST requests are supported" }, 405);
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      console.error("Missing Supabase configuration");
      return jsonResponse({ error: "Server configuration incomplete" }, 500);
    }

    const { user, error: authError } = await getRequestUser(req);
    if (authError || !user) {
      return jsonResponse({ error: "Authentication required" }, 401);
    }

    const payload = (await req.json()) as ManageUserRoleRequest;
    const tenantId = payload.tenantId ?? "";
    const normalizedTenantId = tenantId.trim();
    if (!isUuid(normalizedTenantId)) {
      return jsonResponse({ error: "Valid tenantId is required" }, 400);
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: req.headers.get("authorization") ?? "",
        },
      },
    });

    const authorized = await ensureActorAuthorized(authClient, user.id, normalizedTenantId);
    if (!authorized) {
      return jsonResponse({ error: "Insufficient permissions for tenant" }, 403);
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    if (payload.action === "list") {
      const { data: roleRows, error: roleError } = await adminClient
        .from("user_roles")
        .select("user_id, role, granted_at, granted_by")
        .eq("tenant_id", normalizedTenantId)
        .order("granted_at", { ascending: false });

      if (roleError) {
        console.error("Failed to list user roles", roleError);
        return jsonResponse({ error: "Unable to load staff" }, 500);
      }

      const members = roleRows ?? [];
      if (members.length === 0) {
        return jsonResponse({ members: [] });
      }

      const userIds = Array.from(new Set(members.map((row) => row.user_id)));

      const { data: profiles, error: profileError } = await adminClient
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);

      if (profileError) {
        console.error("Failed to load profiles for staff", profileError);
        return jsonResponse({ error: "Unable to load staff profiles" }, 500);
      }

      const { data: merchantProfiles, error: merchantError } = await adminClient
        .from("merchant_profiles")
        .select("user_id, whatsapp_number_e164, whatsapp_verified_at")
        .in("user_id", userIds);

      if (merchantError) {
        console.error("Failed to load merchant profiles", merchantError);
        return jsonResponse({ error: "Unable to load staff metadata" }, 500);
      }

      const profileMap = new Map(profiles?.map((row) => [row.user_id, row]) ?? []);
      const merchantMap = new Map(merchantProfiles?.map((row) => [row.user_id, row]) ?? []);

      const adminUsers = await Promise.all(
        userIds.map(async (id) => {
          const { data, error } = await adminClient.auth.admin.getUserById(id);
          if (error && error.message !== "User not found") {
            console.error("Failed to lookup auth user", { id, error });
          }
          return { id, user: data?.user ?? null };
        }),
      );

      const adminUserMap = new Map(adminUsers.map((entry) => [entry.id, entry.user]));

      const enriched = members.map((row) => {
        const profile = profileMap.get(row.user_id);
        const merchant = merchantMap.get(row.user_id);
        const authUser = adminUserMap.get(row.user_id);
        return {
          userId: row.user_id,
          role: row.role,
          grantedAt: row.granted_at,
          grantedBy: row.granted_by,
          displayName: profile?.display_name ?? null,
          avatarUrl: profile?.avatar_url ?? null,
          whatsappNumber: merchant?.whatsapp_number_e164 ?? null,
          whatsappVerifiedAt: merchant?.whatsapp_verified_at ?? null,
          email: authUser?.email ?? null,
          emailConfirmedAt: authUser?.email_confirmed_at ?? null,
          lastSignInAt: authUser?.last_sign_in_at ?? null,
        };
      });

      return jsonResponse({ members: enriched });
    }

    if (payload.action === "add") {
      const email = (payload.email ?? "").trim().toLowerCase();
      const role = (payload.role ?? "").trim();

      if (!validateEmail(email)) {
        return jsonResponse({ error: "Valid email is required" }, 400);
      }

      if (!STAFF_ROLES.has(role)) {
        return jsonResponse({ error: "Unsupported role for assignment" }, 400);
      }

      const { userId: targetUserId, invited } = await findOrInviteUser(adminClient, email);

      const { data: upserted, error: roleError } = await adminClient
        .from("user_roles")
        .upsert({ user_id: targetUserId, tenant_id: normalizedTenantId, role }, { onConflict: "user_id,tenant_id,role" })
        .select("user_id, tenant_id, role")
        .single();

      if (roleError || !upserted) {
        console.error("Failed to upsert user role", roleError);
        return jsonResponse({ error: "Unable to assign role" }, 500);
      }

      return jsonResponse({
        status: "assigned",
        invited,
        userId: upserted.user_id,
        tenantId: upserted.tenant_id,
        role: upserted.role,
      });
    }

    if (payload.action === "remove") {
      const email = (payload.email ?? "").trim().toLowerCase();
      const userIdParam = (payload.userId ?? "").trim();

      let targetUserId: string | null = null;

      if (userIdParam && isUuid(userIdParam)) {
        targetUserId = userIdParam;
      }

      if (!targetUserId) {
        if (!validateEmail(email)) {
          return jsonResponse({ error: "Valid email or userId is required" }, 400);
        }

        const lookup = await adminClient.auth.admin.getUserByEmail(email);
        if (lookup.error && lookup.error.message !== "User not found") {
          console.error("Failed to lookup user during removal", lookup.error);
          return jsonResponse({ error: "Unable to locate user" }, 500);
        }

        if (!lookup.data.user) {
          return jsonResponse({ status: "noop", message: "User already absent" });
        }

        targetUserId = lookup.data.user.id;
      }

      const { data: removed, error: removalError } = await adminClient
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId)
        .eq("tenant_id", normalizedTenantId)
        .select("user_id, role");

      if (removalError) {
        console.error("Failed to remove user role", removalError);
        return jsonResponse({ error: "Unable to revoke role" }, 500);
      }

      if (!removed || removed.length === 0) {
        return jsonResponse({ status: "noop", message: "Role not found for user" });
      }

      return jsonResponse({
        status: "revoked",
        userId: targetUserId,
        removedRoles: removed.map((row) => row.role),
      });
    }

    return jsonResponse({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("manage_user_roles failure", error);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
}
