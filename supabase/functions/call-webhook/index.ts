import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CallEvent {
  fromNumber: string;
  toNumber: string;
  callSid?: string;
  transcript?: string;
  intent?: string;
  duration?: number;
  status?: string;
  meta?: Record<string, unknown>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const callEvent: CallEvent = await req.json();

    console.log("Call event received:", {
      callSid: callEvent.callSid,
      fromNumber: callEvent.fromNumber,
      toNumber: callEvent.toNumber,
    });

    // Validate required fields
    if (!callEvent.fromNumber || !callEvent.toNumber) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: fromNumber, toNumber" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Insert call event into database
    const { data, error } = await supabase
      .from("calls")
      .insert({
        from_number: callEvent.fromNumber,
        to_number: callEvent.toNumber,
        call_sid: callEvent.callSid,
        transcript: callEvent.transcript,
        intent: callEvent.intent,
        duration: callEvent.duration,
        status: callEvent.status,
        meta: callEvent.meta || {},
      })
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Call event stored:", data.id);

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing call event:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
