import localManifestFixture from "./fixtures/local-manifest.json" assert { type: "json" };
import remoteManifestFixture from "./fixtures/remote-manifest.json" assert { type: "json" };
import remoteHealthFixture from "./fixtures/remote-health.json" assert { type: "json" };
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

interface TableEntry {
  rows: number;
  checksum: string;
}

interface SnapshotManifest {
  snapshot_id: string;
  label: string;
  generated_at: string;
  tables: Record<string, TableEntry>;
}

interface VerifyRequestPayload {
  local_manifest_url?: unknown;
  remote_manifest_url?: unknown;
  remote_health_url?: unknown;
  useFixtures?: unknown;
}

interface LoadedManifest {
  manifest: SnapshotManifest;
  source: "fixture" | "remote";
  url?: string;
}

interface RemoteHealth {
  ok: boolean;
  region?: string;
  last_snapshot_id?: string;
  [key: string]: unknown;
}

interface TableDiffResult {
  status: "match" | "missing_remote" | "missing_local" | "mismatch";
  local?: TableEntry;
  remote?: TableEntry;
  differences?: Record<string, { local?: unknown; remote?: unknown }>;
}

interface ManifestDiffResult {
  summary: {
    tables_checked: number;
    missing_in_remote: number;
    missing_in_local: number;
    mismatched: number;
    matches: number;
  };
  tables: Record<string, TableDiffResult>;
  metadata: MetadataDiff;
}

const handler = withObs(async (req) => {
  const url = new URL(req.url);
  const requestId = getRequestId(req) ?? crypto.randomUUID();

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("dr-verify-remote");
  }

  if (req.method !== "POST") {
    return jsonError({ error: "method_not_allowed" }, { status: 405, requestId });
  }

  let payload: VerifyRequestPayload;
  try {
    payload = await req.json() as VerifyRequestPayload;
  } catch (_error) {
    return jsonError({ error: "invalid_json" }, { status: 400, requestId });
  }

  const useFixtures = normalizeUseFixtures(payload.useFixtures);
  const validationIssues = validateRemoteInputs(payload, useFixtures);
  if (validationIssues.length > 0) {
    return jsonError(
      { error: "invalid_input", details: { issues: validationIssues } },
      { status: 400, requestId },
    );
  }

  const localManifest = await loadManifest(payload.local_manifest_url, "local", useFixtures);
  const remoteManifest = await loadManifest(payload.remote_manifest_url, "remote", useFixtures);
  const remoteHealth = await loadRemoteHealth(payload.remote_health_url, useFixtures);

  const diff = diffManifests(localManifest.manifest, remoteManifest.manifest);

  return jsonResponse({
    ok: true,
    request_id: requestId,
    manifests: {
      local: {
        snapshot_id: localManifest.manifest.snapshot_id,
        label: localManifest.manifest.label,
        generated_at: localManifest.manifest.generated_at,
        source: localManifest.source,
        url: localManifest.url ?? null,
      },
      remote: {
        snapshot_id: remoteManifest.manifest.snapshot_id,
        label: remoteManifest.manifest.label,
        generated_at: remoteManifest.manifest.generated_at,
        source: remoteManifest.source,
        url: remoteManifest.url ?? null,
      },
    },
    diff,
    remote_health: remoteHealth,
  });
}, { fn: "dr-verify-remote", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

async function loadManifest(
  urlInput: unknown,
  kind: "local" | "remote",
  useFixtures: boolean,
): Promise<LoadedManifest> {
  if (useFixtures || typeof urlInput !== "string" || !urlInput.trim()) {
    const manifest = kind === "local"
      ? cloneManifest(localManifestFixture)
      : cloneManifest(remoteManifestFixture);
    return { manifest, source: "fixture" };
  }

  const url = urlInput.trim();
  const response = await safeFetch(url, { headers: { "accept": "application/json" } });
  const manifest = cloneManifest(await response.json() as SnapshotManifest);
  return { manifest, source: "remote", url };
}

async function loadRemoteHealth(
  urlInput: unknown,
  useFixtures: boolean,
): Promise<RemoteHealth & { source: "fixture" | "remote"; url?: string }> {
  if (useFixtures || typeof urlInput !== "string" || !urlInput.trim()) {
    const health = structuredClone(remoteHealthFixture) as RemoteHealth;
    return { ...health, source: "fixture" };
  }

  const url = urlInput.trim();
  const response = await safeFetch(url, { headers: { "accept": "application/json" } });
  const payload = structuredClone(await response.json() as RemoteHealth) as RemoteHealth;
  return { ...payload, source: "remote", url };
}

async function safeFetch(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `fetch_failed ${input} ${response.status} ${text || response.statusText}`,
    );
  }
  return response;
}

const METADATA_FIELDS: MetadataField[] = [
  "snapshot_id",
  "label",
  "generated_at",
];

function diffManifests(local: SnapshotManifest, remote: SnapshotManifest): ManifestDiffResult {
  const tableNames = new Set<string>([
    ...Object.keys(local.tables ?? {}),
    ...Object.keys(remote.tables ?? {}),
  ]);

  let missingInRemote = 0;
  let missingInLocal = 0;
  let mismatched = 0;
  let matches = 0;

  const tables: Record<string, TableDiffResult> = {};

  const metadata = diffManifestMetadata(local, remote);

  for (const table of tableNames) {
    const localEntry = local.tables?.[table];
    const remoteEntry = remote.tables?.[table];

    if (localEntry && !remoteEntry) {
      tables[table] = { status: "missing_remote", local: localEntry };
      missingInRemote += 1;
      continue;
    }

    if (!localEntry && remoteEntry) {
      tables[table] = { status: "missing_local", remote: remoteEntry };
      missingInLocal += 1;
      continue;
    }

    if (localEntry && remoteEntry) {
      const differences: Record<string, { local?: unknown; remote?: unknown }> = {};
      if (localEntry.rows !== remoteEntry.rows) {
        differences.rows = { local: localEntry.rows, remote: remoteEntry.rows };
      }
      if (localEntry.checksum !== remoteEntry.checksum) {
        differences.checksum = {
          local: localEntry.checksum,
          remote: remoteEntry.checksum,
        };
      }

      if (Object.keys(differences).length > 0) {
        tables[table] = {
          status: "mismatch",
          local: localEntry,
          remote: remoteEntry,
          differences,
        };
        mismatched += 1;
      } else {
        tables[table] = { status: "match", local: localEntry, remote: remoteEntry };
        matches += 1;
      }
    }
  }

  return {
    summary: {
      tables_checked: tableNames.size,
      missing_in_remote: missingInRemote,
      missing_in_local: missingInLocal,
      mismatched,
      matches,
    },
    tables,
    metadata,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function cloneManifest(value: unknown): SnapshotManifest {
  return structuredClone(value) as SnapshotManifest;
}

function jsonError(
  body: { error: string; details?: unknown },
  options: { status?: number; requestId: string },
): Response {
  return jsonResponse(
    { ok: false, request_id: options.requestId, ...body },
    options.status ?? 400,
  );
}

function normalizeUseFixtures(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["false", "0", "no"].includes(normalized)) return false;
    if (["true", "1", "yes", ""].includes(normalized)) return true;
  }
  if (typeof value === "number") {
    if (value === 0) return false;
    if (value === 1) return true;
  }
  return true;
}

interface ValidationIssue {
  field: string;
  message: string;
}

function validateRemoteInputs(
  payload: VerifyRequestPayload,
  useFixtures: boolean,
): ValidationIssue[] {
  if (useFixtures) {
    return [];
  }

  const issues: ValidationIssue[] = [];
  for (const field of [
    "local_manifest_url",
    "remote_manifest_url",
    "remote_health_url",
  ] as const) {
    if (!isNonEmptyString(payload[field])) {
      issues.push({
        field,
        message: "must be a non-empty string when fixtures are disabled",
      });
    }
  }
  return issues;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

type MetadataField = keyof Pick<SnapshotManifest, "snapshot_id" | "label" | "generated_at">;

interface MetadataFieldDiff {
  status: "match" | "mismatch";
  local: string | null;
  remote: string | null;
}

interface MetadataDiff {
  summary: {
    fields_checked: number;
    mismatched: number;
    matches: number;
  };
  fields: Record<MetadataField, MetadataFieldDiff>;
}

function diffManifestMetadata(
  local: SnapshotManifest,
  remote: SnapshotManifest,
): MetadataDiff {
  const fields = {} as Record<MetadataField, MetadataFieldDiff>;
  let matches = 0;
  let mismatched = 0;

  for (const field of METADATA_FIELDS) {
    const localValue = local[field] ?? null;
    const remoteValue = remote[field] ?? null;
    const status = localValue === remoteValue ? "match" : "mismatch";
    if (status === "match") {
      matches += 1;
    } else {
      mismatched += 1;
    }
    fields[field] = { status, local: localValue, remote: remoteValue };
  }

  return {
    summary: {
      fields_checked: METADATA_FIELDS.length,
      mismatched,
      matches,
    },
    fields,
  };
}
