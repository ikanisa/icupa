import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  ALLOWED_MIME_TYPES,
  buildStoragePath,
  emitIngestionEvent,
  ensureStaffForLocation,
  getServiceClient,
  jsonResponse,
  parseBooleanFlag,
  resolveAuthContext,
  sanitizeFilename,
  errorResponse,
} from "../_shared/ingestion.ts";

interface IngestMenuStartRequest {
  ingestion_id?: string;
  location_id?: string;
  original_filename?: string;
  file_mime?: string;
  request_signed_upload?: boolean;
}

const SIGNED_UPLOAD_TTL_SECONDS = Number(Deno.env.get("OCR_SIGNED_UPLOAD_TTL_SECONDS") ?? "900");

function normalizeMime(mime: string | undefined | null): string {
  return (mime ?? "").toLowerCase();
}

serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST requests are supported");
  }

  let payload: IngestMenuStartRequest;
  try {
    payload = (await req.json()) as IngestMenuStartRequest;
  } catch (_error) {
    return errorResponse(400, "invalid_json", "Request body must be valid JSON");
  }

  const locationId = payload.location_id?.trim();
  if (!locationId) {
    return errorResponse(400, "missing_location", "location_id is required");
  }

  const supabase = getServiceClient();

  try {
    const { user } = await resolveAuthContext(req, supabase);
    const staff = await ensureStaffForLocation(supabase, user.id, locationId);

    if (payload.ingestion_id) {
      const ingestionId = payload.ingestion_id.trim();
      const existingResult = await supabase
        .from("menu_ingestions")
        .select(
          "id, tenant_id, location_id, original_filename, storage_path, file_mime, status, currency, metadata"
        )
        .eq("id", ingestionId)
        .maybeSingle();

      if (existingResult.error) {
        console.error("Failed to load existing ingestion", existingResult.error);
        return errorResponse(500, "ingestion_lookup_failed", "Unable to load ingestion");
      }

      const existing = existingResult.data;
      if (!existing) {
        return errorResponse(404, "ingestion_not_found", "Ingestion not found");
      }

      if (existing.tenant_id !== staff.tenantId || existing.location_id !== staff.locationId) {
        return errorResponse(403, "forbidden", "You cannot access this ingestion");
      }

      let uploadUrl: string | undefined;
      const shouldSign = parseBooleanFlag(payload.request_signed_upload, true);
      if (shouldSign && existing.status === "uploaded") {
        const signResult = await supabase.storage
          .from("raw_menus")
          .createSignedUploadUrl(existing.storage_path, SIGNED_UPLOAD_TTL_SECONDS);
        if (signResult.error) {
          console.error("Failed to create signed upload URL", signResult.error);
        } else {
          uploadUrl = signResult.data?.signedUrl ?? undefined;
        }
      }

      return jsonResponse({
        ingestion_id: existing.id,
        status: existing.status,
        upload_url: uploadUrl,
        storage_path: existing.storage_path,
        file_mime: existing.file_mime,
        original_filename: existing.original_filename,
        currency: existing.currency,
        metadata: existing.metadata ?? {},
      });
    }

    const fileMime = normalizeMime(payload.file_mime);
    if (!ALLOWED_MIME_TYPES.has(fileMime)) {
      return errorResponse(400, "unsupported_mime", "File type must be PDF or image");
    }

    const sanitizedFilename = sanitizeFilename(payload.original_filename ?? "menu-upload");
    const ingestionId = crypto.randomUUID();
    const storagePath = buildStoragePath(staff.tenantId, ingestionId, sanitizedFilename);

    const insertResult = await supabase
      .from("menu_ingestions")
      .insert({
        id: ingestionId,
        tenant_id: staff.tenantId,
        location_id: staff.locationId,
        uploaded_by: user.id,
        original_filename: sanitizedFilename,
        storage_path: storagePath,
        file_mime: fileMime,
        status: "uploaded",
        currency: staff.currency ?? null,
        metadata: {
          source: "merchant_portal",
          original_filename: payload.original_filename ?? sanitizedFilename,
          location_id: staff.locationId,
        },
      })
      .select("id, status, storage_path, currency")
      .single();

    if (insertResult.error) {
      console.error("Failed to create ingestion row", insertResult.error);
      return errorResponse(500, "ingestion_create_failed", "Unable to create ingestion");
    }

    await emitIngestionEvent(supabase, staff, {
      event: "started",
      ingestion_id: insertResult.data.id,
      status: "uploaded",
    });

    let uploadUrl: string | undefined;
    const shouldSign = parseBooleanFlag(payload.request_signed_upload, true);
    if (shouldSign) {
      const signResult = await supabase.storage
        .from("raw_menus")
        .createSignedUploadUrl(storagePath, SIGNED_UPLOAD_TTL_SECONDS);
      if (signResult.error) {
        console.error("Failed to create signed upload URL", signResult.error);
      } else {
        uploadUrl = signResult.data?.signedUrl ?? undefined;
      }
    }

    return jsonResponse({
      ingestion_id: insertResult.data.id,
      status: insertResult.data.status,
      upload_url: uploadUrl,
      storage_path: insertResult.data.storage_path,
      currency: insertResult.data.currency,
    }, 201);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error("Unhandled error in ingest_menu_start", error);
    return errorResponse(500, "unhandled_error", "Unexpected error");
  }
});
