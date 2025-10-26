import { describe, expect, it } from "vitest";
import { extractEmbedAuthToken, requireEmbedAuth } from "../auth";

describe("extractEmbedAuthToken", () => {
  it("parses bearer tokens", () => {
    const request = new Request("https://example.com", {
      headers: {
        Authorization: "Bearer secret-token",
      },
    });
    expect(extractEmbedAuthToken(request)).toBe("secret-token");
  });

  it("returns null when header missing", () => {
    const request = new Request("https://example.com");
    expect(extractEmbedAuthToken(request)).toBeNull();
  });
});

describe("requireEmbedAuth", () => {
  const secret = "super-secret";

  it("rejects invalid tokens", async () => {
    const request = new Request("https://example.com", {
      method: "POST",
      headers: { Authorization: "Bearer nope" },
    });
    const response = requireEmbedAuth(request, secret);
    expect(response?.status).toBe(401);
    expect(await response?.json()).toEqual({ error: "Unauthorized" });
  });

  it("allows matching tokens", () => {
    const request = new Request("https://example.com", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const response = requireEmbedAuth(request, secret);
    expect(response).toBeNull();
  });
});
