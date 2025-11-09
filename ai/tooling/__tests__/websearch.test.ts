import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { performWebsearch } from "../websearch";

const originalFetch = global.fetch;

describe("performWebsearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  it("returns normalised results", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        RelatedTopics: [
          { Text: "ICUPA platform", FirstURL: "https://icupa.dev", Result: "ICUPA <b>platform</b>" },
        ],
        AbstractSource: "duckduckgo",
      }),
    } as unknown as Response;

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await performWebsearch({ query: "ICUPA", topK: 2 });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toEqual({
      title: "ICUPA platform",
      url: "https://icupa.dev",
      snippet: "ICUPA platform",
    });
    expect(global.fetch).toHaveBeenCalled();
  });

  it("throws when request fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Internal" });
    await expect(performWebsearch({ query: "ICUPA" })).rejects.toThrow(/Websearch request failed/);
  });
});
