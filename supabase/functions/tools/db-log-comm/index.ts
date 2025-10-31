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

interface CommInput {
  channel: "whatsapp" | "sip" | "email";
  direction: "outbound" | "inbound";
  listing_id?: string;
  contact_id?: string;
  thread_id?: string;
  transcript?: string;
  media?: Record<string, unknown>[] | string[];
  consent_snapshot?: Record<string, unknown>;
  started_at?: string; // ISO timestamp
  ended_at?: string; // ISO timestamp
}

interface CommResponse {
  comm_id: string;
  created_at: string;
}

/**
 * Log a communication event
 * POST /tools/db-log-comm
 * Body: CommInput
 * Returns: { comm_id: string, created_at: string }
 */
export async function handleLogComm(req: Request): Promise<Response> {
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

  let input: CommInput;
  try {
    input = await req.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Validate required fields
  if (!input.channel || !input.direction) {
    return new Response(
      JSON.stringify({ error: "Both 'channel' and 'direction' are required" }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      }
    );
  }

  try {
    const { data, error } = await supabase
      .from("comms")
      .insert({
        channel: input.channel,
        direction: input.direction,
        listing_id: input.listing_id || null,
        contact_id: input.contact_id || null,
        thread_id: input.thread_id || null,
        transcript: input.transcript || null,
        media: input.media || null,
        consent_snapshot: input.consent_snapshot || null,
        started_at: input.started_at ? new Date(input.started_at).toISOString() : new Date().toISOString(),
        ended_at: input.ended_at ? new Date(input.ended_at).toISOString() : null,
      })
      .select("id, started_at")
      .single();

    if (error) {
      throw error;
    }

    const response: CommResponse = {
      comm_id: data.id,
      created_at: data.started_at,
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
    console.error("Error logging communication:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export default handleLogComm;
