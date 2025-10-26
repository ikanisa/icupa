export function extractEmbedAuthToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? req.headers.get("x-api-key");
  if (!header) {
    return null;
  }
  const trimmed = header.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice(7).trim() || null;
  }
  return trimmed;
}

export function requireEmbedAuth(req: Request, secret: string): Response | null {
  if (!secret) {
    throw new Error("EMBED_ITEMS_API_KEY must be set to protect the embed endpoint");
  }
  const token = extractEmbedAuthToken(req);
  if (token !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return null;
}
