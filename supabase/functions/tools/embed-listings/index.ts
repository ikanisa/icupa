import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.3";
import { requireAuth } from "../_shared/auth.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const openAiKey = Deno.env.get("OPENAI_API_KEY");
const toolsApiKey = Deno.env.get("RE_TOOLS_API_KEY");
const embeddingModel = Deno.env.get("OPENAI_EMBEDDING_MODEL") || "text-embedding-3-small";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  global: { fetch: fetch },
});

interface ListingRecord {
  id: string;
  title: string;
  description: string | null;
  amenities: string[] | null;
  location_text: string | null;
  type: string | null;
  price_eur: number | null;
  beds: number | null;
  baths: number | null;
}

interface EmbedRequestBody {
  listing_ids?: string[];
  force?: boolean;
  limit?: number;
}

const MAX_BATCH = 32;

async function fetchListings(
  listingIds: string[] | undefined,
  force: boolean,
  limit: number
): Promise<ListingRecord[]> {
  let query = supabase
    .from("listings")
    .select("id, title, description, amenities, location_text, type, price_eur, beds, baths");

  if (listingIds && listingIds.length > 0) {
    query = query.in("id", listingIds);
  } else if (!force) {
    // Only fetch listings that don't have embeddings yet
    const { data: existingEmbeddings } = await supabase
      .from("embeddings")
      .select("listing_id");
    
    const embeddedIds = (existingEmbeddings || []).map((e: { listing_id: string }) => e.listing_id);
    
    if (embeddedIds.length > 0) {
      query = query.not("id", "in", `(${embeddedIds.join(",")})`);
    }
  }

  query = query.order("updated_at", { ascending: false }).limit(limit);

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data || [];
}

function createChunk(listing: ListingRecord): string {
  const parts = [];
  
  if (listing.title) {
    parts.push(`Title: ${listing.title}`);
  }
  
  if (listing.description) {
    parts.push(`Description: ${listing.description}`);
  }
  
  if (listing.location_text) {
    parts.push(`Location: ${listing.location_text}`);
  }
  
  if (listing.type) {
    parts.push(`Type: ${listing.type}`);
  }
  
  if (listing.price_eur !== null) {
    parts.push(`Price: €${listing.price_eur}/month`);
  }
  
  if (listing.beds !== null) {
    parts.push(`Bedrooms: ${listing.beds}`);
  }
  
  if (listing.baths !== null) {
    parts.push(`Bathrooms: ${listing.baths}`);
  }
  
  if (listing.amenities && Array.isArray(listing.amenities) && listing.amenities.length > 0) {
    parts.push(`Amenities: ${listing.amenities.join(", ")}`);
  }
  
  return parts.join("\n");
}

async function createEmbeddings(inputs: string[]): Promise<number[][]> {
  if (!openAiKey) {
    throw new Error("OPENAI_API_KEY must be set for embedding generation");
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

async function updateEmbeddings(
  listings: ListingRecord[]
): Promise<{ updated: number }> {
  let updated = 0;

  for (let i = 0; i < listings.length; i += MAX_BATCH) {
    const batch = listings.slice(i, i + MAX_BATCH);
    const inputs = batch.map(listing => createChunk(listing));
    const embeddings = await createEmbeddings(inputs);

    const updates = batch.map((listing, index) => ({
      listing_id: listing.id,
      vector: embeddings[index],
      chunk: inputs[index],
      model: embeddingModel,
    }));

    const { error } = await supabase
      .from("embeddings")
      .upsert(updates, { onConflict: "listing_id" });

    if (error) {
      throw error;
    }
    updated += updates.length;
  }

  return { updated };
}

/**
 * Generate embeddings for listings
 * POST /tools/embed-listings
 * Body: { listing_ids?: string[], force?: boolean, limit?: number }
 * Returns: { updated: number }
 */
export async function handleEmbedListings(req: Request): Promise<Response> {
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

  let body: EmbedRequestBody = {};
  try {
    if (req.headers.get("content-length")) {
      body = await req.json();
    }
  } catch (_) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const limit = Math.min(Math.max(body.limit || MAX_BATCH, 1), 256);

  try {
    const listings = await fetchListings(
      body.listing_ids,
      body.force || false,
      limit
    );

    if (!listings.length) {
      return new Response(
        JSON.stringify({
          updated: 0,
          message: "No listings eligible for embedding",
        }),
        {
          status: 200,
          headers: { 
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const result = await updateEmbeddings(listings);

    return new Response(JSON.stringify({ updated: result.updated }), {
      status: 200,
      headers: { 
        "content-type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error embedding listings:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export default handleEmbedListings;
