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
    const { data: pendingJournal, error: fetchError } = await supabase
      .from("pending_journals")
      .select("*")
      .eq("id", pending_journal_id)
      .single();

    if (fetchError || !pendingJournal) {
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
      const { data: glEntry, error: glError } = await supabase
        .from("gl_entries")
        .insert({
          entry_date: pendingJournal.entry_date,
          account_dr: pendingJournal.account_dr,
          account_cr: pendingJournal.account_cr,
          amount: pendingJournal.amount,
          memo: pendingJournal.memo,
          posted_by: approverId,
        })
        .select()
        .single();

      if (glError) {
        return new Response(JSON.stringify({ error: "Failed to post journal", details: glError }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update pending journal status
      const { error: updateError } = await supabase
        .from("pending_journals")
        .update({
          status: "approved",
          approved_by: approverId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", pending_journal_id);

      if (updateError) {
        console.error("Failed to update pending journal status:", updateError);
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
      const { error: updateError } = await supabase
        .from("pending_journals")
        .update({
          status: "rejected",
          approved_by: approverId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", pending_journal_id);

      if (updateError) {
        return new Response(JSON.stringify({ error: "Failed to reject journal", details: updateError }), {
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
