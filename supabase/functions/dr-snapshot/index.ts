import { serve } from "serve";
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BUCKET = Deno.env.get("DR_SNAPSHOT_BUCKET") ?? "dr_backups";
const OFFLINE_DIR = Deno.env.get("DR_SNAPSHOT_OFFLINE_DIR") ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Supabase configuration missing for dr-snapshot");
}

const DEFAULT_TABLES = [
  "core.profiles",
  "booking.itineraries",
  "booking.items",
  "payment.payments",
  '"group".members',
  '"group".escrows',
  '"group".contributions',
  "fin.invoices",
  "audit.events",
];

const handler = withObs(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("dr-snapshot");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const requestId = getRequestId(req) ?? crypto.randomUUID();

  let payload: { label?: unknown; tables?: unknown };
  try {
    payload = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const labelInput = typeof payload.label === "string" && payload.label.trim()
    ? payload.label.trim()
    : undefined;
  if (!labelInput) {
    return jsonResponse({ ok: false, error: "label_required" }, 400);
  }

  const tablesInput = Array.isArray(payload.tables)
    ? payload.tables
        .map((value) => typeof value === "string" ? value.trim() : "")
        .filter((value) => value.length > 0)
    : undefined;
  const tables = (tablesInput && tablesInput.length > 0)
    ? tablesInput
    : DEFAULT_TABLES;

  const dataBundle: Record<string, unknown> = {};
  const captureErrors: Record<string, string> = {};

  for (const table of tables) {
    try {
      const rows = await fetchAllRows(table);
      dataBundle[table] = rows;
    } catch (error) {
      captureErrors[table] = error instanceof Error
        ? error.message
        : String(error);
    }
  }

  if (Object.keys(captureErrors).length > 0) {
    return jsonResponse({ ok: false, error: "table_fetch_failed", details: captureErrors }, 502);
  }

  const bundle = {
    meta: {
      tables,
      generated_at: new Date().toISOString(),
      label: labelInput,
    },
    data: dataBundle,
  };

  const encoder = new TextEncoder();
  const jsonText = JSON.stringify(bundle);
  const jsonBytes = encoder.encode(jsonText);
  const bytes = jsonBytes.byteLength;
  const sha256 = await digestHex(jsonBytes);

  const now = new Date();
  const objectPath = buildObjectPath(labelInput, now, "json");

  let storedObjectPath = `dr_backups/${objectPath}`;
  let uploaded = false;

  try {
    await ensureBucket(BUCKET);
    await putObject(BUCKET, objectPath, jsonBytes, "application/json");
    uploaded = true;
  } catch (error) {
    if (OFFLINE_DIR) {
      const filePath = `${OFFLINE_DIR.replace(/\/$/, "")}/${objectPath.replaceAll("/", "_")}`;
      try {
        await Deno.mkdir(OFFLINE_DIR, { recursive: true });
        await Deno.writeFile(filePath, jsonBytes);
        storedObjectPath = `offline://${filePath}`;
      } catch (writeError) {
        return jsonResponse({
          ok: false,
          error: "storage_unavailable",
          details: {
            upload_error: error instanceof Error ? error.message : String(error),
            write_error: writeError instanceof Error ? writeError.message : String(writeError),
          },
        }, 502);
      }
    } else {
      return jsonResponse({
        ok: false,
        error: "storage_upload_failed",
        details: error instanceof Error ? error.message : String(error),
      }, 502);
    }
  }

  const insert = await insertSnapshot({
    label: labelInput,
    tables,
    object_path: storedObjectPath,
    bytes,
    sha256,
    created_by: "function",
  });

  console.log(JSON.stringify({
    level: "AUDIT",
    event: "dr.snapshot",
    fn: "dr-snapshot",
    requestId,
    bucket: BUCKET,
    object_path: storedObjectPath,
    bytes,
    sha256,
    tables,
    uploaded,
  }));

  return jsonResponse({
    ok: true,
    snapshot_id: insert.id,
    object_path: storedObjectPath,
    bytes,
    sha256,
  });
}, { fn: "dr-snapshot", defaultErrorCode: ERROR_CODES.UNKNOWN });

serve(handler);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function sanitizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "snapshot";
}

function buildObjectPath(label: string, date: Date, extension: "json" | "sql.gz"): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const time = date.toISOString().replace(/[:.]/g, "").replace("Z", "Z");
  const safeLabel = sanitizeLabel(label);
  return `${year}/${month}/${day}/${safeLabel}_${time}.${extension}`;
}

type TableProfile = { path: string; acceptProfile?: string };

function resolveTableProfile(table: string): TableProfile {
  if (!table.includes(".")) {
    return { path: table };
  }
  const parts = table.split(".");
  const schema = parts.slice(0, -1).join(".").replace(/"/g, "");
  const rawTable = parts.at(-1) ?? table;
  const cleanTable = rawTable.replace(/"/g, "");
  return { path: cleanTable, acceptProfile: schema };
}

async function fetchAllRows(table: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  const pageSize = 1000;
  const { path, acceptProfile } = resolveTableProfile(table);
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const headers: HeadersInit = {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Prefer: "count=exact",
      Range: `items=${from}-${to}`,
    };
    if (acceptProfile) {
      (headers as Record<string, string>)["Accept-Profile"] = acceptProfile;
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${encodeURIComponent(path)}?select=*`,
      {
        headers,
      },
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`fetch ${table} failed: ${text || response.statusText}`);
    }

    const chunk = await response.json();
    if (Array.isArray(chunk)) {
      rows.push(...chunk);
      if (chunk.length < pageSize) {
        break;
      }
      from += pageSize;
    } else {
      break;
    }
  }

  return rows;
}

async function ensureBucket(bucket: string): Promise<void> {
  try {
    const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: bucket, public: false }),
    });
    if (!response.ok && response.status !== 409) {
      await response.text();
    }
  } catch (_error) {
    // ignored: offline or permissions issues surface on upload
  }
}

async function putObject(
  bucket: string,
  objectPath: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${objectPath}`,
    {
      method: "PUT",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": contentType,
      },
      body: bytes,
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`storage upload failed: ${text || response.statusText}`);
  }
}

async function insertSnapshot(body: Record<string, unknown>): Promise<{ id: string }> {
  const headers: HeadersInit = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    "Accept-Profile": "dr",
    "Content-Profile": "dr",
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/snapshots`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`insert snapshot failed: ${text || response.statusText}`);
  }

  const payload = await response.json();
  if (Array.isArray(payload) && payload[0] && typeof payload[0].id === "string") {
    return { id: payload[0].id };
  }
  throw new Error("snapshot insert missing id");
}

async function digestHex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const array = Array.from(new Uint8Array(digest));
  return array.map((b) => b.toString(16).padStart(2, "0")).join("");
}
