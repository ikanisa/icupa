import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import {
  ALLOWED_MIME_TYPES,
  MENU_SCHEMA,
  OCR_IMAGE_MAX_EDGE,
  OCR_MAX_PAGES,
  OCR_MIN_CONFIDENCE,
  buildPreviewPath,
  emitIngestionEvent,
  ensureStaffForLocation,
  errorResponse,
  getServiceClient,
  jsonResponse,
  resolveAuthContext,
} from "../_shared/ingestion.ts";
import type { IngestionRecord, StaffContext } from "../_shared/ingestion.ts";
import { mergePageResults } from "../../../packages/ingestion-utils/src/merge.ts";
import type { MergeResult, PageResult } from "../../../packages/ingestion-utils/src/types.ts";

interface ProcessRequestBody {
  ingestion_id?: string;
  rerun?: boolean;
}

interface PageAsset {
  page: number;
  base64: string;
  contentType: string;
  previewPath: string;
}

interface PagePreviewMeta {
  page: number;
  path: string;
  content_type: string;
}

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_MODEL = Deno.env.get("OCR_OPENAI_MODEL") ?? "gpt-4o";
const OCR_CONVERTER_URL = Deno.env.get("OCR_CONVERTER_URL") ?? "";
const OCR_CONVERTER_TOKEN = Deno.env.get("OCR_CONVERTER_TOKEN") ?? "";
const SIGNED_DOWNLOAD_TTL_SECONDS = Number(Deno.env.get("OCR_SIGNED_DOWNLOAD_TTL_SECONDS") ?? "600");

if (!OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not configured for ingest_menu_process");
}

async function fetchIngestionRecord(client: ReturnType<typeof getServiceClient>, ingestionId: string) {
  const { data, error } = await client
    .from("menu_ingestions")
    .select(
      "id, tenant_id, location_id, storage_path, file_mime, status, currency, metadata, original_filename"
    )
    .eq("id", ingestionId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load ingestion", error);
    throw errorResponse(500, "ingestion_lookup_failed", "Unable to load ingestion record");
  }

  if (!data) {
    throw errorResponse(404, "ingestion_not_found", "Ingestion not found");
  }

  return data as IngestionRecord & { original_filename: string | null };
}

async function ensureSignedDownload(client: ReturnType<typeof getServiceClient>, path: string): Promise<string> {
  const { data, error } = await client.storage.from("raw_menus").createSignedUrl(path, SIGNED_DOWNLOAD_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error("Failed to create signed download URL", error);
    throw errorResponse(500, "download_url_failed", "Unable to generate download link");
  }
  return data.signedUrl;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64Encode(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function convertPdfToImages(downloadUrl: string): Promise<PageAsset[]> {
  if (!OCR_CONVERTER_URL) {
    throw errorResponse(500, "converter_not_configured", "OCR converter endpoint is not configured");
  }

  const payload = {
    source_url: downloadUrl,
    max_pages: OCR_MAX_PAGES,
    max_edge: OCR_IMAGE_MAX_EDGE,
  };

  const response = await fetch(OCR_CONVERTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(OCR_CONVERTER_TOKEN ? { Authorization: `Bearer ${OCR_CONVERTER_TOKEN}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("PDF converter returned error", response.status, text);
    throw errorResponse(502, "converter_failed", "Unable to convert PDF to images");
  }

  const json = await response.json() as { images: { page: number; base64: string; content_type: string }[] };
  if (!Array.isArray(json.images)) {
    throw errorResponse(502, "converter_invalid", "Converter response missing images payload");
  }

  return json.images.slice(0, OCR_MAX_PAGES).map((entry) => ({
    page: entry.page,
    base64: entry.base64,
    contentType: entry.content_type ?? "image/png",
    previewPath: "",
  }));
}

async function loadImageFromUrl(downloadUrl: string, contentType: string): Promise<PageAsset[]> {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    console.error("Failed to fetch image", response.status, await response.text());
    throw errorResponse(502, "image_fetch_failed", "Unable to download menu image");
  }
  const buffer = await response.arrayBuffer();
  return [
    {
      page: 1,
      base64: arrayBufferToBase64(buffer),
      contentType,
      previewPath: "",
    },
  ];
}

async function persistPreviews(
  client: ReturnType<typeof getServiceClient>,
  staff: StaffContext,
  ingestionId: string,
  assets: PageAsset[],
): Promise<PagePreviewMeta[]> {
  const previews: PagePreviewMeta[] = [];

  for (const asset of assets) {
    const extension = asset.contentType.includes("png") ? "png" : asset.contentType.includes("jpeg") ? "jpg" : "webp";
    const path = buildPreviewPath(staff.tenantId, ingestionId, asset.page, extension);
    const bytes = base64ToUint8Array(asset.base64);

    const uploadResult = await client.storage
      .from("menu_images")
      .upload(path, bytes, {
        upsert: true,
        contentType: asset.contentType,
      });

    if (uploadResult.error) {
      console.error("Failed to upload page preview", uploadResult.error, path);
      throw errorResponse(500, "preview_upload_failed", "Unable to store page preview");
    }

    asset.previewPath = path;
    previews.push({ page: asset.page, path, content_type: asset.contentType });
  }

  return previews;
}

async function callOpenAiForPage(asset: PageAsset): Promise<PageResult> {
  if (!OPENAI_API_KEY) {
    throw errorResponse(500, "openai_not_configured", "OPENAI_API_KEY is not configured");
  }

  const body = {
    model: OPENAI_MODEL,
    input: [
      {
        role: "system",
        content: [
          {
            type: "text",
            text:
              "You extract structured menu data for restaurants. Return currency codes and price numbers (no currency symbols). Leave allergens empty if not explicit. Return confidence per item between 0 and 1.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract menu categories and items from this page. Do not hallucinate missing allergens or prices.",
          },
          {
            type: "input_image",
            image_url: `data:${asset.contentType};base64,${asset.base64}`,
            detail: "high",
          },
        ],
      },
    ],
    temperature: 0.1,
    response_format: {
      type: "json_schema",
      json_schema: MENU_SCHEMA,
    },
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("OpenAI response error", response.status, text);
    throw errorResponse(502, "openai_failure", "Vision model failed to process page");
  }

  const json = await response.json();
  const structuredPayload = extractPayload(json);
  return {
    page: asset.page,
    payload: structuredPayload,
    rawText: JSON.stringify(structuredPayload),
  };
}

function extractPayload(response: unknown) {
  const fallback = { currency: "XXX", categories: [] };
  if (!response || typeof response !== "object") {
    return fallback;
  }

  const asRecord = response as Record<string, unknown>;
  const outputText =
    (Array.isArray(asRecord.output_text) && asRecord.output_text.join("\n")) ||
    (typeof asRecord.output_text === "string" ? asRecord.output_text : undefined);

  if (outputText) {
    try {
      return JSON.parse(outputText);
    } catch (_) {
      console.warn("Failed to parse output_text, falling back to nested content");
    }
  }

  const output = asRecord.output ?? asRecord.data ?? [];
  if (Array.isArray(output)) {
    for (const entry of output) {
      if (!entry || typeof entry !== "object") continue;
      const content = (entry as Record<string, unknown>).content;
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item && typeof item === "object" && (item as Record<string, unknown>).type === "output_text") {
            const text = (item as Record<string, unknown>).text;
            if (typeof text === "string") {
              try {
                return JSON.parse(text);
              } catch (error) {
                console.warn("Failed to parse nested output_text", error);
              }
            }
          }
        }
      }
    }
  }

  return fallback;
}

async function processIngestion(
  supabase: ReturnType<typeof getServiceClient>,
  staff: StaffContext,
  ingestion: IngestionRecord & { original_filename: string | null },
): Promise<MergeResult & { previews: PagePreviewMeta[] }> {
  const downloadUrl = await ensureSignedDownload(supabase, ingestion.storage_path);
  let assets: PageAsset[] = [];

  if (ingestion.file_mime === "application/pdf") {
    assets = await convertPdfToImages(downloadUrl);
  } else if (ALLOWED_MIME_TYPES.has(ingestion.file_mime)) {
    assets = await loadImageFromUrl(downloadUrl, ingestion.file_mime);
  } else {
    throw errorResponse(400, "unsupported_mime", "File type must be PDF or image");
  }

  const previews = await persistPreviews(supabase, staff, ingestion.id, assets);

  const pageResults: PageResult[] = [];
  for (const asset of assets) {
    try {
      const result = await callOpenAiForPage(asset);
      pageResults.push(result);
    } catch (error) {
      if (error instanceof Response) {
        throw error;
      }
      console.error("OpenAI processing failure", error);
      throw errorResponse(502, "vision_failed", "Vision extraction failed");
    }
  }

  const mergeResult = mergePageResults(pageResults, {
    ingestionCurrency: ingestion.currency,
    minConfidence: OCR_MIN_CONFIDENCE,
  });

  return { ...mergeResult, previews };
}

async function writeStagingRows(
  supabase: ReturnType<typeof getServiceClient>,
  ingestion: IngestionRecord,
  mergeResult: MergeResult,
) {
  await supabase.from("menu_items_staging").delete().eq("ingestion_id", ingestion.id);

  if (mergeResult.items.length === 0) {
    return;
  }

  const rows = mergeResult.items.map((item) => ({
    ingestion_id: ingestion.id,
    category_name: item.category_name,
    name: item.name,
    description: item.description,
    price_cents: item.price_cents,
    currency: item.currency ?? ingestion.currency,
    allergens: item.allergens ?? [],
    tags: item.tags ?? [],
    is_alcohol: item.is_alcohol ?? false,
    confidence: item.confidence ?? null,
    media_url: item.media_url,
    flags: item.flags ?? {},
  }));

  const { error } = await supabase.from("menu_items_staging").insert(rows);
  if (error) {
    console.error("Failed to insert staging rows", error);
    throw errorResponse(500, "staging_insert_failed", "Unable to store ingestion results");
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST requests are supported");
  }

  let payload: ProcessRequestBody;
  try {
    payload = (await req.json()) as ProcessRequestBody;
  } catch (_error) {
    return errorResponse(400, "invalid_json", "Request body must be valid JSON");
  }

  const ingestionId = payload.ingestion_id?.trim();
  if (!ingestionId) {
    return errorResponse(400, "missing_ingestion_id", "ingestion_id is required");
  }

  const supabase = getServiceClient();
  let staff: StaffContext | null = null;
  let resolvedIngestion: (IngestionRecord & { original_filename: string | null }) | null = null;

  try {
    const { user } = await resolveAuthContext(req, supabase);
    const ingestion = await fetchIngestionRecord(supabase, ingestionId);
    resolvedIngestion = ingestion;
    staff = await ensureStaffForLocation(supabase, user.id, ingestion.location_id);

    await emitIngestionEvent(supabase, staff, {
      event: "processing",
      ingestion_id: ingestion.id,
      status: "processing",
    });

    const startUpdate = await supabase
      .from("menu_ingestions")
      .update({
        status: "processing",
        metadata: {
          ...(ingestion.metadata ?? {}),
          process_started_at: new Date().toISOString(),
          process_started_by: user.id,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", ingestion.id);

    if (startUpdate.error) {
      console.error("Failed to transition ingestion to processing", startUpdate.error);
      throw errorResponse(500, "ingestion_update_failed", "Unable to flag ingestion as processing");
    }

    const merge = await processIngestion(supabase, staff, ingestion);
    await writeStagingRows(supabase, ingestion, merge);

    const updateResult = await supabase
      .from("menu_ingestions")
      .update({
        status: "awaiting_review",
        pages_processed: merge.previews.length,
        items_count: merge.itemsCount,
        raw_text: merge.rawText,
        structured_json: merge.structured,
        currency: merge.structured.currency ?? ingestion.currency,
        metadata: {
          ...(ingestion.metadata ?? {}),
          process_completed_at: new Date().toISOString(),
          page_previews: merge.previews,
          confidence_buckets: merge.confidenceBuckets,
        },
        errors: [],
        updated_at: new Date().toISOString(),
      })
      .eq("id", ingestion.id)
      .select("id")
      .maybeSingle();

    if (updateResult.error) {
      console.error("Failed to update ingestion after processing", updateResult.error);
      throw errorResponse(500, "ingestion_update_failed", "Unable to finalise ingestion");
    }

    await emitIngestionEvent(supabase, staff, {
      event: "awaiting_review",
      ingestion_id: ingestion.id,
      status: "awaiting_review",
      items_count: merge.itemsCount,
      pages_processed: merge.previews.length,
      confidence: merge.confidenceBuckets,
    });

    return jsonResponse({
      ok: true,
      items_count: merge.itemsCount,
      pages_processed: merge.previews.length,
      errors: [],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : error instanceof Response ? error.statusText : "Unexpected error";

    console.error("Unhandled error in ingest_menu_process", error);

    await supabase
      .from("menu_ingestions")
      .update({
        status: "failed",
        errors: [{ message }],
        updated_at: new Date().toISOString(),
      })
      .eq("id", ingestionId);

    if (staff && resolvedIngestion) {
      await emitIngestionEvent(supabase, staff, {
        event: "failed",
        ingestion_id: resolvedIngestion.id,
        status: "failed",
        errors: [{ message }],
      });
    }

    if (error instanceof Response) {
      return error;
    }

    return errorResponse(500, "unhandled_error", "Unexpected error");
  }
});
