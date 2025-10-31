import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/headers.ts";

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

    // Fetch the pending journal entry
    const appMetadata = (userData.user.app_metadata ?? {}) as Record<string, unknown>;
    const rawRoles =
      (appMetadata.mcp_roles as string[] | string | undefined) ??
      (appMetadata.roles as string[] | string | undefined);

    const userRoles = Array.isArray(rawRoles)
      ? rawRoles
      : rawRoles
        ? String(rawRoles)
            .split(",")
            .map((role) => role.trim())
            .filter(Boolean)
        : [];

    if (!userRoles.includes("cfo_agent")) {
      return new Response(JSON.stringify({ error: "User lacks CFO approval permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const executeAsCfo = async (
      sql: string,
      params: Array<{ type: "uuid" | "number" | "string" | "date" | "timestamp" | "jsonb"; value: unknown }>,
    ) => {
      const { data, error } = await supabase.rpc("mcp_execute_tool", {
        role: "cfo_agent",
        sql,
        params,
        rls_context: {},
      });

      if (error) {
        throw new Error(error.message ?? "MCP execution failed");
      }
      return data;
    };

    const pendingResult = await executeAsCfo(
      "select * from public.pending_journals where id = $1",
      [{ type: "uuid", value: pending_journal_id }],
    );

    const pendingJournal = Array.isArray(pendingResult) ? pendingResult[0] : null;

    if (!pendingJournal) {
      return new Response(JSON.stringify({ error: "Pending journal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (pendingJournal.status !== "pending") {
      return new Response(
        JSON.stringify({ error: `Journal already ${pendingJournal.status}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle approval
    if (action === "approve") {
      // Post the journal entry to gl_entries
      const glResult = await executeAsCfo(
        "insert into public.gl_entries (entry_date, account_dr, account_cr, amount, memo, posted_by) values ($1, $2, $3, $4, $5, $6) returning id",
        [
          { type: "date", value: pendingJournal.entry_date },
          { type: "string", value: pendingJournal.account_dr },
          { type: "string", value: pendingJournal.account_cr },
          { type: "number", value: pendingJournal.amount },
          { type: "string", value: pendingJournal.memo ?? null },
          { type: "uuid", value: approverId },
        ],
      );

      const glEntry = Array.isArray(glResult) ? glResult[0] : null;

      if (!glEntry) {
        return new Response(JSON.stringify({ error: "Failed to post journal" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update pending journal status
      const approvalUpdate = await executeAsCfo(
        "update public.pending_journals set status = 'approved', approved_by = $1, approved_at = now() where id = $2",
        [
          { type: "uuid", value: approverId },
          { type: "uuid", value: pending_journal_id },
        ],
      );

      if (!approvalUpdate || (approvalUpdate as { row_count?: number }).row_count !== 1) {
        return new Response(JSON.stringify({ error: "Failed to finalize journal approval" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // TODO: Send notification (Slack/email) to requester
      // This can be implemented using a webhook or email service

      return new Response(
        JSON.stringify({
          success: true,
          message: "Journal entry approved and posted",
          gl_entry_id: glEntry.id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else if (action === "reject") {
      // Update pending journal status to rejected
      const rejectionUpdate = await executeAsCfo(
        "update public.pending_journals set status = 'rejected', approved_by = $1, approved_at = now() where id = $2",
        [
          { type: "uuid", value: approverId },
          { type: "uuid", value: pending_journal_id },
        ],
      );

      if (!rejectionUpdate || (rejectionUpdate as { row_count?: number }).row_count !== 1) {
        return new Response(JSON.stringify({ error: "Failed to reject journal" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // TODO: Send notification (Slack/email) to requester
      // This can be implemented using a webhook or email service

      return new Response(
        JSON.stringify({
          success: true,
          message: "Journal entry rejected",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(JSON.stringify({ error: "Invalid action. Use 'approve' or 'reject'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
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
