import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const openAiKey = Deno.env.get("OPENAI_API_KEY");
const embeddingModel = Deno.env.get("OPENAI_EMBEDDING_MODEL") ?? "text-embedding-3-large";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

if (!openAiKey) {
  throw new Error("OPENAI_API_KEY must be configured for semantic search");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  global: { fetch },
});

const MAX_LIMIT = 12;

interface SearchRequestBody {
  query?: string;
  limit?: number;
  minScore?: number;
}

async function resolveTableContext(tableSessionId: string) {
  const sessionResponse = await supabase
    .from("table_sessions")
    .select<{ id: string; table_id: string | null; expires_at: string | null }>(
      "id, table_id, expires_at"
    )
    .eq("id", tableSessionId)
    .maybeSingle();

  if (sessionResponse.error) {
    throw sessionResponse.error;
  }
  const session = sessionResponse.data;
  if (!session || !session.table_id) {
    return null;
  }

  if (session.expires_at) {
    const expiresAt = Date.parse(session.expires_at);
    if (!Number.isNaN(expiresAt) && expiresAt < Date.now()) {
      return null;
    }
  }

  const tableResponse = await supabase
    .from("tables")
    .select<{ id: string; location_id: string | null }>("id, location_id")
    .eq("id", session.table_id)
    .maybeSingle();

  if (tableResponse.error) {
    throw tableResponse.error;
  }
  const table = tableResponse.data;
  if (!table || !table.location_id) {
    return null;
  }

  const locationResponse = await supabase
    .from("locations")
    .select<{ id: string; tenant_id: string | null }>("id, tenant_id")
    .eq("id", table.location_id)
    .maybeSingle();

  if (locationResponse.error) {
    throw locationResponse.error;
  }
  const location = locationResponse.data;
  if (!location) {
    return null;
  }

  return {
    tenantId: location.tenant_id ?? null,
    locationId: table.location_id,
  };
}

async function createEmbedding(input: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: embeddingModel,
      input,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${detail}`);
  }

  const payload = await response.json();
  const [embedding] = payload.data ?? [];
  if (!embedding || !Array.isArray(embedding.embedding)) {
    throw new Error("Unexpected embedding payload from OpenAI");
  }

  return embedding.embedding as number[];
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const sessionHeader = req.headers.get("x-icupa-session");
  if (!sessionHeader) {
    return new Response(
      JSON.stringify({ error: "Missing x-icupa-session header" }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      },
    );
  }

  let body: SearchRequestBody = {};
  if (req.headers.get("content-length")) {
    try {
      body = await req.json();
    } catch (_) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
  }

  const query = body.query?.trim();
  if (!query) {
    return new Response(JSON.stringify({ error: "Query text is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const limit = Math.min(Math.max(body.limit ?? 6, 1), MAX_LIMIT);
  const minScore = Math.min(Math.max(body.minScore ?? 0.55, 0), 1);

  try {
    const context = await resolveTableContext(sessionHeader);
    if (!context) {
      return new Response(JSON.stringify({ error: "Invalid or expired table session" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }

    const embedding = await createEmbedding(query);

    const { data, error } = await supabase.rpc(
      "search_menu_items",
      {
        query_embedding: embedding,
        target_tenant: context.tenantId,
        target_location: context.locationId,
        match_limit: limit,
        min_score: minScore,
      },
    );

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        query,
        results: data ?? [],
        context,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
