import {
  ensureStaffForLocation,
  errorResponse,
  getServiceClient,
  jsonResponse,
  resolveAuthContext,
} from "../../../_shared/ingestion.ts";

interface Auto86RequestBody {
  location_id?: string;
  item_ids?: string[];
  enable?: boolean; // true -> enable items (rollback), false -> disable items (86)
  reason?: string;
}

export async function handleMerchantInventoryAuto86(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST is supported");
  }

  let payload: Auto86RequestBody;
  try {
    payload = (await req.json()) as Auto86RequestBody;
  } catch (_error) {
    return errorResponse(400, "invalid_json", "Request body must be valid JSON");
  }

  const locationId = (payload.location_id ?? "").trim();
  const itemIds = Array.isArray(payload.item_ids) ? payload.item_ids.filter((id) => typeof id === "string" && id.length > 0) : [];
  const enable = Boolean(payload.enable);
  const reason = (payload.reason ?? (enable ? "manual_rollback" : "auto_86")).slice(0, 80);

  if (!locationId) {
    return errorResponse(400, "missing_location", "location_id is required");
  }
  if (itemIds.length === 0) {
    return errorResponse(400, "missing_items", "Provide at least one item_id");
  }

  const supabase = getServiceClient();

  try {
    const { user } = await resolveAuthContext(req, supabase);
    const staff = await ensureStaffForLocation(supabase, user.id, locationId);

    const { data: updated, error: updateError } = await supabase
      .from("items")
      .update({ is_available: enable })
      .in("id", itemIds)
      .eq("location_id", locationId)
      .select("id");

    if (updateError) {
      console.error("auto_86 update failed", updateError);
      return errorResponse(500, "update_failed", "Unable to update item availability");
    }

    try {
      await supabase.from("events").insert({
        tenant_id: staff.tenantId,
        location_id: staff.locationId,
        type: enable ? "inventory.enable" : "inventory.auto_86",
        payload: {
          item_ids: itemIds,
          updated_count: updated?.length ?? 0,
          reason,
          enable,
        },
      });
    } catch (e) {
      console.error("Failed to log inventory event", e);
    }

    return jsonResponse({ updated: updated?.length ?? 0, enable });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Unhandled error in inventory auto_86", error);
    return errorResponse(500, "unhandled_error", "Unexpected error");
  }
}

export default handleMerchantInventoryAuto86;
