import { ERROR_CODES } from "./constants.ts";
import { getSupabaseServiceConfig } from "./env.ts";

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } =
  getSupabaseServiceConfig({ feature: "auth" });

export interface UserContext {
  userId: string | null;
  profileId: string | null;
  persona: string | null;
  isOps: boolean;
  isService: boolean;
  authHeader: string | null;
}

const PUBLIC_HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Accept-Profile": "core",
} as const;

export async function resolveUserContext(req: Request): Promise<UserContext> {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? null;

  if (!authHeader) {
    return {
      userId: null,
      profileId: null,
      persona: null,
      isOps: false,
      isService: false,
      authHeader: null,
    };
  }

  if (authHeader === `Bearer ${SERVICE_ROLE_KEY}`) {
    return {
      userId: null,
      profileId: null,
      persona: "service",
      isOps: true,
      isService: true,
      authHeader,
    };
  }

  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: authHeader,
      },
    });

    if (!userRes.ok) {
      return {
        userId: null,
        profileId: null,
        persona: null,
        isOps: false,
        isService: false,
        authHeader,
      };
    }

    const userPayload = await userRes.json() as { id?: string };
    const userId = typeof userPayload?.id === "string" ? userPayload.id : null;
    if (!userId) {
      return {
        userId: null,
        profileId: null,
        persona: null,
        isOps: false,
        isService: false,
        authHeader,
      };
    }

    let profileId: string | null = null;
    let persona: string | null = null;
    try {
      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/core.profiles?select=id,persona&auth_user_id=eq.${userId}&limit=1`,
        { headers: PUBLIC_HEADERS },
      );
      if (profileRes.ok) {
        const rows = await profileRes.json();
        if (Array.isArray(rows) && rows[0]) {
          profileId = typeof rows[0].id === "string" ? rows[0].id : null;
          persona = typeof rows[0].persona === "string" ? rows[0].persona : null;
        }
      }
    } catch (_err) {
      // ignore profile lookup errors
    }

    return {
      userId,
      profileId,
      persona,
      isOps: persona === "ops",
      isService: false,
      authHeader,
    };
  } catch (_error) {
    return {
      userId: null,
      profileId: null,
      persona: null,
      isOps: false,
      isService: false,
      authHeader,
    };
  }
}

export function assertAuthenticated(context: UserContext): asserts context is UserContext & { userId: string; profileId: string } {
  if (!context.userId || !context.profileId) {
    const error = new Error("Authentication required");
    (error as { code?: string }).code = ERROR_CODES.UNAUTHORIZED;
    throw error;
  }
}

export function assertOpsAccess(context: UserContext) {
  if (!context.isOps && !context.isService) {
    const error = new Error("Operator access required");
    (error as { code?: string }).code = ERROR_CODES.UNAUTHORIZED;
    throw error;
  }
}
