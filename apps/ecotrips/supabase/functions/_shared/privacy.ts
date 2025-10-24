import { getSupabaseServiceConfig } from "./env.ts";

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } =
  getSupabaseServiceConfig({ feature: "privacy" });

const JSON_HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

export interface PrivacyRequestRow {
  id: string;
  kind: "export" | "erasure";
  requester_user_id: string | null;
  subject_user_id: string;
  status: string;
  reason: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
}

export async function callRpc<T = unknown>(
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(args ?? {}),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${name} failed: ${text || response.statusText}`);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

export async function getAuthUser(
  req: Request,
): Promise<{ id: string; role?: string } | null> {
  const authHeader = req.headers.get("authorization") ??
    req.headers.get("Authorization") ?? "";
  if (!authHeader) return null;
  if (authHeader === `Bearer ${SERVICE_ROLE_KEY}`) {
    return { id: "service-role", role: "service" };
  }
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: authHeader,
      apikey: SERVICE_ROLE_KEY,
    },
  });
  if (!response.ok) {
    return null;
  }
  const payload = await response.json() as { id?: string };
  if (payload?.id) {
    return { id: payload.id };
  }
  return null;
}

export async function uploadJsonToBucket(
  bucket: string,
  objectPath: string,
  data: unknown,
): Promise<void> {
  try {
    const ensure = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: bucket, public: false }),
    });
    if (!ensure.ok && String(ensure.status) !== "409") {
      await ensure.text();
      // ignore non-fatal ensure errors; upload will fail if bucket truly missing
    }
  } catch (_error) {
    // bucket API unavailable; proceed to upload and surface real failure if any
  }

  const put = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${objectPath}`,
    {
      method: "PUT",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data ?? {}),
    },
  );
  if (!put.ok) {
    const text = await put.text();
    throw new Error(`storage upload failed: ${text || put.statusText}`);
  }
}

export async function signBucketObject(
  bucket: string,
  objectPath: string,
  expiresSeconds = 60 * 60 * 24 * 30,
): Promise<string> {
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${objectPath}`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: expiresSeconds }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`sign object failed: ${text || response.statusText}`);
  }
  const payload = await response.json() as { signedURL?: string };
  if (!payload.signedURL) {
    throw new Error("signed URL missing");
  }
  return `${SUPABASE_URL}${payload.signedURL}`;
}

export async function removeBucketObject(
  bucket: string,
  objectPath: string,
): Promise<void> {
  await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${objectPath}`, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
}

export async function logPrivacyAudit(
  who: string | null,
  what: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await callRpc("privacy_log_audit", {
    p_who: sanitizeActorId(who),
    p_what: what,
    p_payload: payload,
  });
}

export async function getRequestRow(
  requestId: string,
): Promise<PrivacyRequestRow | null> {
  const row = await callRpc<PrivacyRequestRow | null>("privacy_get_request", {
    p_request_id: requestId,
  });
  return row ?? null;
}

export function sanitizeActorId(value: string | null): string | null {
  if (!value) return null;
  return UUID_REGEX.test(value) ? value : null;
}

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
