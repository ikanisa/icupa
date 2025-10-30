import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleSearchListings } from "./db-search-listings/index.ts";
import { handleGetListing } from "./db-get-listing/index.ts";
import { handleSaveLeadRequest } from "./db-save-lead-request/index.ts";
import { handleSaveMatches } from "./db-save-matches/index.ts";
import { handleLogComm } from "./db-log-comm/index.ts";
import { handleEmbedListings } from "./embed-listings/index.ts";

function extractSubPath(req: Request, prefix: string): string | null {
  const url = new URL(req.url);
  let basePath = url.pathname.replace(/^\/?functions\/v1\//, "");
  basePath = basePath.replace(/^\/+/, "");
  if (!basePath.startsWith(prefix)) {
    return null;
  }
  const remainder = basePath.slice(prefix.length);
  return remainder.replace(/^\/+/, "");
}

serve(async (req) => {
  const subPath = extractSubPath(req, "tools");
  
  // Add CORS headers for preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
      },
    });
  }

  switch (subPath) {
    case "db-search-listings":
    case "db.search_listings":
      return handleSearchListings(req);
    case "db-get-listing":
    case "db.get_listing":
      return handleGetListing(req);
    case "db-save-lead-request":
    case "db.save_lead_request":
      return handleSaveLeadRequest(req);
    case "db-save-matches":
    case "db.save_matches":
      return handleSaveMatches(req);
    case "db-log-comm":
    case "db.log_comm":
      return handleLogComm(req);
    case "embed-listings":
    case "embed_listings":
      return handleEmbedListings(req);
    default:
      return new Response(JSON.stringify({ 
        error: "Not Found",
        available_paths: [
          "db-search-listings",
          "db-get-listing", 
          "db-save-lead-request",
          "db-save-matches",
          "db-log-comm",
          "embed-listings"
        ]
      }), {
        status: 404,
        headers: { 
          'content-type': 'application/json',
          "Access-Control-Allow-Origin": "*",
        },
      });
  }
});
