import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.3";
import { requireAuth } from "../_shared/auth.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const toolsApiKey = Deno.env.get("RE_TOOLS_API_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  global: { fetch: fetch },
});

/**
 * Get a single listing by ID with full details
 * GET /tools/db-get-listing?id=<uuid>
 * Returns: Full listing record
 */
export async function handleGetListing(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  const authError = requireAuth(req, toolsApiKey);
  if (authError) {
    return authError;
  }

  const url = new URL(req.url);
  const listingId = url.searchParams.get("id");

  if (!listingId) {
    return new Response(JSON.stringify({ error: "Missing 'id' query parameter" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("id", listingId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return new Response(JSON.stringify({ error: "Listing not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }
      throw error;
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 
        "content-type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching listing:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export default handleGetListing;
