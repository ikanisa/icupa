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

interface MatchInput {
  lead_request_id: string;
  listing_id: string;
  score: number;
  reasons?: string[] | Record<string, unknown>;
  status?: string;
}

interface SaveMatchesInput {
  matches: MatchInput[];
}

interface SaveMatchesResponse {
  inserted: number;
  updated: number;
  match_ids: string[];
}

/**
 * Save or update matches
 * POST /tools/db-save-matches
 * Body: { matches: MatchInput[] }
 * Returns: { inserted: number, updated: number, match_ids: string[] }
 */
export async function handleSaveMatches(req: Request): Promise<Response> {
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

  let input: SaveMatchesInput;
  try {
    input = await req.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!input.matches || !Array.isArray(input.matches)) {
    return new Response(JSON.stringify({ error: "Missing or invalid 'matches' array" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const matchRecords = input.matches.map(match => ({
      lead_request_id: match.lead_request_id,
      listing_id: match.listing_id,
      score: match.score,
      reasons: match.reasons || null,
      status: match.status || "pending_owner",
    }));

    // Use upsert to handle duplicates (based on unique constraint if any)
    // For now, we'll insert new records
    const { data, error } = await supabase
      .from("matches")
      .insert(matchRecords)
      .select("id");

    if (error) {
      throw error;
    }

    const response: SaveMatchesResponse = {
      inserted: data?.length || 0,
      updated: 0, // Not tracking updates separately for now
      match_ids: (data || []).map((row: { id: string }) => row.id),
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
    console.error("Error saving matches:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export default handleSaveMatches;
