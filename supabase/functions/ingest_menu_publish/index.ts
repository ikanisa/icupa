import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  emitIngestionEvent,
  ensureStaffForLocation,
  errorResponse,
  getServiceClient,
  jsonResponse,
  resolveAuthContext,
} from "../_shared/ingestion.ts";
import type { IngestionRecord, StaffContext } from "../_shared/ingestion.ts";

interface PublishRequestBody {
  ingestion_id?: string;
  menu_id?: string;
}

interface PublishResult {
  items_upserted: number;
  categories_created: number;
  version: number;
  item_ids: string[];
}

async function fetchIngestion(client: ReturnType<typeof getServiceClient>, ingestionId: string) {
  const { data, error } = await client
    .from("menu_ingestions")
    .select("id, tenant_id, location_id, status, currency, metadata")
    .eq("id", ingestionId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load ingestion", error);
    throw errorResponse(500, "ingestion_lookup_failed", "Unable to load ingestion");
  }

  if (!data) {
    throw errorResponse(404, "ingestion_not_found", "Ingestion not found");
  }

  return data as IngestionRecord;
}

async function fetchMenu(client: ReturnType<typeof getServiceClient>, menuId: string) {
  const { data, error } = await client
    .from("menus")
    .select("id, tenant_id, location_id, version")
    .eq("id", menuId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load menu", error);
    throw errorResponse(500, "menu_lookup_failed", "Unable to load menu");
  }

  if (!data) {
    throw errorResponse(404, "menu_not_found", "Menu not found");
  }

  return data as { id: string; tenant_id: string; location_id: string; version: number };
}

serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST requests are supported");
  }

  let payload: PublishRequestBody;
  try {
    payload = (await req.json()) as PublishRequestBody;
  } catch (_error) {
    return errorResponse(400, "invalid_json", "Request body must be valid JSON");
  }

  const ingestionId = payload.ingestion_id?.trim();
  const menuId = payload.menu_id?.trim();

  if (!ingestionId || !menuId) {
    return errorResponse(400, "missing_parameters", "ingestion_id and menu_id are required");
  }

  const supabase = getServiceClient();
  let staff: StaffContext | null = null;
  let ingestion: IngestionRecord | null = null;

  try {
    const { user } = await resolveAuthContext(req, supabase);
    ingestion = await fetchIngestion(supabase, ingestionId);

    if (!['awaiting_review', 'processing', 'uploaded'].includes(ingestion.status) && ingestion.status !== 'published') {
      console.warn("Ingestion in unexpected status", ingestion.status);
    }

    staff = await ensureStaffForLocation(supabase, user.id, ingestion.location_id);

    const menu = await fetchMenu(supabase, menuId);

    if (menu.tenant_id !== ingestion.tenant_id || menu.location_id !== ingestion.location_id) {
      return errorResponse(403, "tenant_mismatch", "Menu does not belong to ingestion tenant/location");
    }

    const rpcResult = await supabase.rpc("publish_menu_ingestion", {
      p_ingestion_id: ingestionId,
      p_menu_id: menuId,
      p_actor: user.id,
    });

    if (rpcResult.error) {
      console.error("publish_menu_ingestion RPC failed", rpcResult.error);
      throw errorResponse(500, "publish_failed", "Unable to publish ingestion");
    }

    const result = (rpcResult.data ?? {}) as PublishResult;

    await emitIngestionEvent(supabase, staff, {
      event: "published",
      ingestion_id: ingestionId,
      status: "published",
      items_count: result.items_upserted,
    });

    if (Array.isArray(result.item_ids) && result.item_ids.length > 0) {
      try {
        await supabase.functions.invoke("menu/embed_items", {
          body: { item_ids: result.item_ids, force: true },
        });
      } catch (embedError) {
        console.error("Failed to trigger embed_items", embedError);
      }
    }

    return jsonResponse({
      published: true,
      items_upserted: result.items_upserted ?? 0,
      categories_created: result.categories_created ?? 0,
      version: result.version ?? menu.version + 1,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : error instanceof Response ? error.statusText : "Unexpected error";

    console.error("Unhandled error in ingest_menu_publish", error);

    await supabase
      .from("menu_ingestions")
      .update({
        status: "failed",
        errors: [{ message }],
        updated_at: new Date().toISOString(),
      })
      .eq("id", ingestionId);

    if (staff && ingestion) {
      await emitIngestionEvent(supabase, staff, {
        event: "failed",
        ingestion_id: ingestion.id,
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
