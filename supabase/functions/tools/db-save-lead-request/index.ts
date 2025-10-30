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

interface LeadRequestInput {
  seeker_contact_id?: string;
  prefs?: Record<string, unknown>;
  budget_min?: number;
  budget_max?: number;
  locations?: string[];
  long_or_short?: "long" | "short";
}

interface LeadRequestResponse {
  lead_request_id: string;
  created_at: string;
}

/**
 * Save a new lead request
 * POST /tools/db-save-lead-request
 * Body: LeadRequestInput
 * Returns: { lead_request_id: string, created_at: string }
 */
export async function handleSaveLeadRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  const authError = requireAuth(req, toolsApiKey);
  if (authError) {
    return authError;
  }

  let input: LeadRequestInput = {};
  try {
    input = await req.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    // Validate required fields
    if (!input.budget_min && !input.budget_max && !input.locations) {
      return new Response(
        JSON.stringify({ error: "At least one of budget_min, budget_max, or locations is required" }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    const { data, error } = await supabase
      .from("lead_requests")
      .insert({
        seeker_contact_id: input.seeker_contact_id || null,
        prefs: input.prefs || null,
        budget_min: input.budget_min || null,
        budget_max: input.budget_max || null,
        locations: input.locations || null,
        long_or_short: input.long_or_short || null,
      })
      .select("id, created_at")
      .single();

    if (error) {
      throw error;
    }

    const response: LeadRequestResponse = {
      lead_request_id: data.id,
      created_at: data.created_at,
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { 
        "content-type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error saving lead request:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export default handleSaveLeadRequest;
