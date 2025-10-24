import { getSupabaseServiceConfig } from "./env.ts";

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } =
  getSupabaseServiceConfig({ feature: "supplier" });

const PUBLIC_HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

export interface SupplierAuthContext {
  valid: boolean;
  userId: string | null;
  supplierSlug: string | null;
  actor: string;
}

export async function resolveSupplierAuth(req: Request): Promise<SupplierAuthContext> {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!header) {
    return { valid: false, userId: null, supplierSlug: null, actor: "anonymous" };
  }

  if (header === `Bearer ${SERVICE_ROLE_KEY}`) {
    return { valid: true, userId: "service-role", supplierSlug: "aurora-expeditions", actor: "service-role" };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: header,
        apikey: SERVICE_ROLE_KEY,
      },
    });

    if (!response.ok) {
      return { valid: false, userId: null, supplierSlug: null, actor: "unauthorized" };
    }

    const payload = await response.json() as {
      id?: string;
      user_metadata?: Record<string, unknown>;
      app_metadata?: Record<string, unknown>;
    };

    const userId = typeof payload?.id === "string" ? payload.id : null;
    const userRoles = new Set<string>();
    const appRoles = Array.isArray(payload?.app_metadata?.roles)
      ? (payload?.app_metadata?.roles as unknown[])
      : [];
    const profileRoles = Array.isArray(payload?.user_metadata?.roles)
      ? (payload?.user_metadata?.roles as unknown[])
      : [];

    for (const role of [...appRoles, ...profileRoles]) {
      if (typeof role === "string" && role) {
        userRoles.add(role.toLowerCase());
      }
    }

    const supplierSlugRaw = typeof payload?.user_metadata?.supplier_slug === "string"
      ? payload.user_metadata?.supplier_slug
      : typeof payload?.user_metadata?.supplier_id === "string"
        ? payload.user_metadata?.supplier_id
        : null;

    if (!userId || (!userRoles.has("supplier") && !userRoles.has("partner"))) {
      return { valid: false, userId: null, supplierSlug: null, actor: userId ?? "unknown" };
    }

    const supplierSlug = supplierSlugRaw?.toLowerCase()?.replace(/[^a-z0-9-]/g, "") || "aurora-expeditions";
    return { valid: true, userId, supplierSlug, actor: userId };
  } catch (_error) {
    return { valid: false, userId: null, supplierSlug: null, actor: "error" };
  }
}

export async function fetchSupplierTrustBadges(supplierSlug: string): Promise<Array<TrustBadgeRow>> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/trust_badges?select=id,code,label,description,supplier_slug,active&supplier_slug=eq.${encodeURIComponent(supplierSlug)}&active=eq.true`,
    {
      headers: PUBLIC_HEADERS,
    },
  );

  if (!response.ok) {
    return [];
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows as TrustBadgeRow[];
}

export interface TrustBadgeRow {
  id: string;
  code: string;
  label: string;
  description: string | null;
  supplier_slug: string;
  active: boolean;
}
