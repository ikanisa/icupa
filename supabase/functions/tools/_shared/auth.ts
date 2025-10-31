/**
 * Authentication helpers for Real Estate Agent tools
 */

export function extractApiKey(req: Request): string | null {
  // Try Authorization header with Bearer token
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      return match[1];
    }
  }
  
  // Try x-api-key header
  const apiKeyHeader = req.headers.get("x-api-key");
  if (apiKeyHeader) {
    return apiKeyHeader;
  }
  
  return null;
}

export function requireAuth(req: Request, expectedKey: string | undefined): Response | null {
  if (!expectedKey) {
    // If no key is configured, allow all requests (development mode)
    console.warn("No API key configured - authentication disabled");
    return null;
  }
  
  const providedKey = extractApiKey(req);
  
  if (!providedKey) {
    return new Response(JSON.stringify({ error: "Missing authentication credentials" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  
  if (providedKey !== expectedKey) {
    return new Response(JSON.stringify({ error: "Invalid authentication credentials" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }
  
  return null;
}

export function requireServiceRoleKey(req: Request, serviceRoleKey: string): Response | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || match[1] !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Invalid service role key" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }
  
  return null;
}
