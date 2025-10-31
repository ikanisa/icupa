import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/headers.ts";

function extractRoles(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function hasCfoPrivileges(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }): boolean {
  const roles = new Set<string>();

  const appMetadata = user.app_metadata ?? {};
  const userMetadata = user.user_metadata ?? {};

  for (const key of ["roles", "role", "mcp_roles", "agent_roles"]) {
    extractRoles((appMetadata as Record<string, unknown>)[key]).forEach((role) => roles.add(role));
    extractRoles((userMetadata as Record<string, unknown>)[key]).forEach((role) => roles.add(role));
  }

  const normalizedRoles = Array.from(roles).map((role) => role.toLowerCase());
  return normalizedRoles.some((role) => role === "cfo" || role === "cfo_agent");
}

interface ApprovalRequest {
  pending_journal_id: string;
  action: "approve" | "reject";
  approver_notes?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Parse request body
    const { pending_journal_id, action, approver_notes }: ApprovalRequest = await req.json();

    if (!pending_journal_id || !action) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: pending_journal_id, action" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the authorization header to identify approver
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the JWT and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const approverId = userData.user.id;

    if (!hasCfoPrivileges(userData.user)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action !== "approve" && action !== "reject") {
      return new Response(JSON.stringify({ error: "Invalid action. Use 'approve' or 'reject'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "mcp_handle_pending_journal",
      {
        action,
        pending_journal_id,
        approver: approverId,
        notes: approver_notes ?? null,
      }
    );

    if (rpcError) {
      console.error("Journal approval RPC failed", rpcError);
      return new Response(JSON.stringify({ error: "Failed to process journal", details: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        result: rpcResult,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in approve_journal:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
