import { WebsearchInput } from "../schemas";
import { createServerSupabaseClient } from "@icupa/db";

const DEFAULT_ENDPOINT = "https://api.duckduckgo.com/";

export interface WebsearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebsearchResponse {
  query: string;
  results: WebsearchResult[];
  source: string;
  latencyMs: number;
  fetchedAt: string;
}

const supabaseClient = (() => {
  try {
    if (typeof process !== "undefined" && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return createServerSupabaseClient();
    }
  } catch (error) {
    console.warn("Failed to initialise Supabase client for websearch logging", error);
  }
  return null;
})();

function normaliseResults(payload: any, topK: number): WebsearchResult[] {
  const relatedTopics = Array.isArray(payload?.RelatedTopics) ? payload.RelatedTopics : [];
  const results: WebsearchResult[] = [];

  for (const entry of relatedTopics) {
    if (results.length >= topK) {
      break;
    }

    if (entry && typeof entry === "object") {
      const title = typeof entry.Text === "string" ? entry.Text : typeof entry.Result === "string" ? entry.Result : "";
      const url = typeof entry.FirstURL === "string" ? entry.FirstURL : "";
      const snippet = typeof entry.Result === "string" ? entry.Result.replace(/<[^>]+>/g, "") : title;
      if (title && url) {
        results.push({ title, url, snippet });
      }
    }
  }

  if (results.length === 0 && typeof payload?.AbstractText === "string" && payload.AbstractText.length > 0) {
    results.push({
      title: payload.Heading || "Summary",
      url: payload.AbstractURL || "",
      snippet: payload.AbstractText,
    });
  }

  return results.slice(0, topK);
}

export async function performWebsearch(rawInput: unknown): Promise<WebsearchResponse> {
  const input = WebsearchInput.parse(rawInput);
  const endpoint = process.env.WEBSEARCH_ENDPOINT ?? DEFAULT_ENDPOINT;
  const url = new URL(endpoint);
  url.searchParams.set("q", input.query);
  url.searchParams.set("format", "json");
  url.searchParams.set("no_redirect", "1");
  url.searchParams.set("no_html", "1");
  if (input.locale) {
    url.searchParams.set("kl", input.locale);
  }

  const getNow = typeof performance !== "undefined" ? () => performance.now() : () => Date.now();
  const start = getNow();
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ICUPA-Agent/1.0",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Websearch request failed: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const latencyMs = Math.round(getNow() - start);
  const results = normaliseResults(json, input.topK);
  const payload: WebsearchResponse = {
    query: input.query,
    results,
    source: json?.AbstractSource || "duckduckgo",
    latencyMs,
    fetchedAt: new Date().toISOString(),
  };

  if (supabaseClient) {
    try {
      await supabaseClient.from("websearch_queries").insert({
        tenant_id: input.tenantId ?? null,
        agent_type: input.agentType ?? null,
        query: input.query,
        results,
        latency_ms: latencyMs,
        source: payload.source,
      });
    } catch (error) {
      console.warn("Failed to log websearch query", error);
    }
  }

  return payload;
}
