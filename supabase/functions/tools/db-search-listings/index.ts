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

interface SearchFilters {
  budget_min?: number;
  budget_max?: number;
  locations?: string[];
  beds?: number;
  baths?: number;
  type?: string;
  longlet?: boolean;
  shortlet?: boolean;
  furnished?: boolean;
  pets?: boolean;
  amenities?: string[];
  available_from?: string; // ISO date
  limit?: number;
}

interface SearchResponse {
  listing_ids: string[];
  count: number;
}

/**
 * Search listings based on filters
 * POST /tools/db-search-listings
 * Body: SearchFilters
 * Returns: { listing_ids: string[], count: number }
 */
export async function handleSearchListings(req: Request): Promise<Response> {
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

  let filters: SearchFilters = {};
  try {
    filters = await req.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    // Build query with filters
    let query = supabase
      .from("listings")
      .select("id", { count: "exact" });

    // Price filter
    if (filters.budget_min !== undefined) {
      query = query.gte("price_eur", filters.budget_min);
    }
    if (filters.budget_max !== undefined) {
      query = query.lte("price_eur", filters.budget_max);
    }

    // Location filter (case-insensitive partial match)
    if (filters.locations && filters.locations.length > 0) {
      const locationConditions = filters.locations.map(loc => 
        `location_text.ilike.%${loc}%`
      ).join(',');
      query = query.or(locationConditions);
    }

    // Beds/baths filters
    if (filters.beds !== undefined) {
      query = query.gte("beds", filters.beds);
    }
    if (filters.baths !== undefined) {
      query = query.gte("baths", filters.baths);
    }

    // Property type
    if (filters.type) {
      query = query.eq("type", filters.type);
    }

    // Rental duration
    if (filters.longlet !== undefined) {
      query = query.eq("longlet_bool", filters.longlet);
    }
    if (filters.shortlet !== undefined) {
      query = query.eq("shortlet_bool", filters.shortlet);
    }

    // Furnished
    if (filters.furnished !== undefined) {
      query = query.eq("furnished", filters.furnished);
    }

    // Pets
    if (filters.pets !== undefined) {
      query = query.eq("pets", filters.pets);
    }

    // Amenities (contains any of the specified amenities)
    if (filters.amenities && filters.amenities.length > 0) {
      const amenitiesConditions = filters.amenities.map(amenity =>
        `amenities.cs.["${amenity}"]`
      ).join(',');
      query = query.or(amenitiesConditions);
    }

    // Available from date
    if (filters.available_from) {
      query = query.lte("available_from", filters.available_from);
    }

    // Order by updated_at (most recent first)
    query = query.order("updated_at", { ascending: false });

    // Limit results (default 80, max 200)
    const limit = Math.min(filters.limit || 80, 200);
    query = query.limit(limit);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    const listingIds = (data || []).map((row: { id: string }) => row.id);
    
    const response: SearchResponse = {
      listing_ids: listingIds,
      count: count || 0,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 
        "content-type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error searching listings:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export default handleSearchListings;
