import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2";
import { MENU_SCHEMA } from "../../../packages/ingestion-utils/src/schema.ts";
import type { MergeResult } from "../../../packages/ingestion-utils/src/types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Supabase credentials missing for ingestion helpers");
}

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export const OCR_MAX_PAGES = Number(Deno.env.get("OCR_MAX_PAGES") ?? "25");
export const OCR_IMAGE_MAX_EDGE = Number(Deno.env.get("OCR_IMAGE_MAX_EDGE") ?? "1200");
export const OCR_MIN_CONFIDENCE = Number(Deno.env.get("OCR_MIN_CONFIDENCE") ?? "0.55");

export interface JsonError {
  error: { code: string; message: string };
}

export interface AuthContext {
  token: string;
  user: User;
}

export interface StaffContext {
  tenantId: string;
  locationId: string;
  currency: string | null;
  roles: string[];
}

export interface IngestionRecord {
  id: string;
  tenant_id: string;
  location_id: string;
  storage_path: string;
  file_mime: string;
  status: string;
  currency: string | null;
  metadata: Record<string, unknown> | null;
}

export interface IngestionEventPayload {
  event: "started" | "processing" | "awaiting_review" | "published" | "failed";
  ingestion_id: string;
  status: string;
  items_count?: number;
  pages_processed?: number;
  errors?: unknown[];
  confidence?: MergeResult["confidenceBuckets"];
}

export function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse({ error: { code, message } }, status);
}

export function getServiceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export async function resolveAuthContext(req: Request, client: SupabaseClient): Promise<AuthContext> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    throw errorResponse(401, "unauthorized", "Bearer token required");
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw errorResponse(401, "unauthorized", "Bearer token required");
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    console.error("Failed to resolve user from token", error);
    throw errorResponse(401, "unauthorized", "Invalid or expired token");
  }

  return { token, user: data.user };
}

const STAFF_ROLES = ["owner", "manager", "admin", "support"];

export async function ensureStaffForLocation(
  client: SupabaseClient,
  userId: string,
  locationId: string,
): Promise<StaffContext> {
  const locationResult = await client
    .from("locations")
    .select("id, tenant_id, currency")
    .eq("id", locationId)
    .maybeSingle();

  if (locationResult.error) {
    console.error("Failed to fetch location for ingestion", locationResult.error);
    throw errorResponse(500, "location_lookup_failed", "Unable to load location");
  }

  if (!locationResult.data) {
    throw errorResponse(404, "location_not_found", "Location was not found");
  }

  const tenantId = locationResult.data.tenant_id as string;

  const roleResult = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .in("role", STAFF_ROLES);

  if (roleResult.error) {
    console.error("Failed to verify staff role", roleResult.error);
    throw errorResponse(500, "role_check_failed", "Unable to verify permissions");
  }

  const roles = roleResult.data?.map((row) => row.role) ?? [];
  if (roles.length === 0) {
    throw errorResponse(403, "forbidden", "You do not have access to this location");
  }

  return {
    tenantId,
    locationId,
    currency: (locationResult.data.currency as string | null) ?? null,
    roles,
  };
}

export function sanitizeFilename(original: string): string {
  const fallback = `menu-${Date.now()}`;
  const base = (original ?? "").trim() || fallback;
  const withoutPath = base.split("/").pop() ?? fallback;
  const normalized = withoutPath
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

export function buildStoragePath(tenantId: string, ingestionId: string, filename: string): string {
  const safeTenant = tenantId.replace(/[^a-z0-9-]+/gi, "");
  const safeIngestion = ingestionId.replace(/[^a-z0-9-]+/gi, "");
  return `${safeTenant}/${safeIngestion}/${filename}`;
}

export function buildPreviewPath(tenantId: string, ingestionId: string, page: number, extension = "png"): string {
  return `${tenantId.replace(/[^a-z0-9-]+/gi, "")}/${ingestionId.replace(/[^a-z0-9-]+/gi, "")}/page-${String(page).padStart(3, "0")}.${extension}`;
}

export function parseBooleanFlag(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return ["true", "1", "yes", "y"].includes(value.toLowerCase());
  }
  return fallback;
}

export async function emitIngestionEvent(
  client: SupabaseClient,
  staff: StaffContext,
  payload: IngestionEventPayload,
): Promise<void> {
  await client.from("agent_events").insert({
    agent_type: "menu_ingestion",
    session_id: payload.ingestion_id,
    tenant_id: staff.tenantId,
    location_id: staff.locationId,
    payload,
  });
}

export { MENU_SCHEMA };
