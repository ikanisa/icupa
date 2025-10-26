import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const openAiKey = Deno.env.get("OPENAI_API_KEY");
const embedItemsSecret = Deno.env.get("EMBED_ITEMS_API_KEY");
const embeddingModel = Deno.env.get("OPENAI_EMBEDDING_MODEL") ?? "text-embedding-3-large";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

if (!embedItemsSecret) {
  throw new Error("EMBED_ITEMS_API_KEY must be set to protect the embed endpoint");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  global: { fetch: fetch },
});

interface EmbedRequestBody {
  item_ids?: string[];
  force?: boolean;
}

interface ItemRecord {
  id: string;
  name: string;
  description: string | null;
}

const MAX_BATCH = 32;

function extractAuthToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? req.headers.get("x-api-key");
  if (!header) {
    return null;
  }
  const trimmed = header.trim();
  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice(7).trim();
  }
  return trimmed;
}

async function fetchItems(itemIds: string[] | undefined, force: boolean, limit: number): Promise<ItemRecord[]> {
  let query = supabase.from<ItemRecord>("items").select("id,name,description");

  if (itemIds && itemIds.length > 0) {
    query = query.in("id", itemIds);
  } else if (!force) {
    query = query.is("embedding", null);
  }

  query = query.order("updated_at", { ascending: false }).limit(limit);

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data ?? [];
}

async function createEmbeddings(inputs: string[]): Promise<number[][]> {
  if (!openAiKey) {
    throw new Error("OPENAI_API_KEY must be set for embedding refresh");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: embeddingModel,
      input: inputs,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${message}`);
  }

  const json = await response.json();
  return json.data.map((entry: { embedding: number[] }) => entry.embedding);
}

async function updateEmbeddings(items: ItemRecord[]): Promise<{ updated: number }> {
  let updated = 0;

  for (let i = 0; i < items.length; i += MAX_BATCH) {
    const batch = items.slice(i, i + MAX_BATCH);
    const inputs = batch.map((item) =>
      [item.name, item.description ?? ""].filter(Boolean).join("\n\n")
    );
    const embeddings = await createEmbeddings(inputs);

    const updates = batch.map((item, index) => ({
      id: item.id,
      embedding: embeddings[index],
    }));

    const { error } = await supabase.from("items").upsert(updates, { onConflict: "id" });
    if (error) {
      throw error;
    }
    updated += updates.length;
  }

  return { updated };
}

export async function handleEmbedItems(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const token = extractAuthToken(req);
  if (token !== embedItemsSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam ?? MAX_BATCH) || MAX_BATCH, 1), 256);

  let body: EmbedRequestBody = {};
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

  try {
    const items = await fetchItems(body.item_ids, body.force ?? false, limit);
    if (!items.length) {
      return new Response(JSON.stringify({ updated: 0, message: "No items eligible for embedding" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const result = await updateEmbeddings(items);
    return new Response(JSON.stringify({ updated: result.updated }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export default handleEmbedItems;
