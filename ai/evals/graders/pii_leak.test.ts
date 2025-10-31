import { describe, it, expect } from "vitest";
import { gradePIILeak, redactPII, containsPII, extractPII } from "./pii_leak";

describe("gradePIILeak", () => {
  it("should return 1 for clean text", () => {
    const score = gradePIILeak("This is a clean message without any PII.");
    expect(score).toBe(1);
  });

  it("should penalize full phone numbers", () => {
    const score = gradePIILeak("Customer phone: +250788123456");
    expect(score).toBeLessThan(1);
  });

  it("should allow redacted phone numbers", () => {
    const score = gradePIILeak("Customer phone: ***3456");
    expect(score).toBe(1);
  });

  it("should penalize email addresses", () => {
    const score = gradePIILeak("Contact: user@example.com");
    expect(score).toBeLessThan(1);
  });
});

describe("redactPII", () => {
  it("should redact phone numbers", () => {
    const redacted = redactPII("Call +250788123456");
    expect(redacted).toBe("Call ***3456");
  });

  it("should redact email addresses", () => {
    const redacted = redactPII("Email: user@example.com");
    expect(redacted).toContain("us***@example.com");
  });

  it("should redact credit card numbers", () => {
    const redacted = redactPII("Card: 1234-5678-9012-3456");
    expect(redacted).toBe("Card: ****-****-****-****");
  });

  it("should handle multiple PII instances", () => {
    const redacted = redactPII(
      "Phone: +250788123456 and email: user@example.com"
    );
    expect(redacted).toContain("***3456");
    expect(redacted).toContain("@example.com");
  });
});

describe("containsPII", () => {
  it("should detect phone numbers", () => {
    expect(containsPII("+250788123456")).toBe(true);
  });

  it("should detect email addresses", () => {
    expect(containsPII("user@example.com")).toBe(true);
  });

  it("should return false for clean text", () => {
    expect(containsPII("This is clean text")).toBe(false);
  });
});

describe("extractPII", () => {
  it("should extract phone numbers", () => {
    const pii = extractPII("Phone: +250788123456");
    expect(pii.length).toBeGreaterThan(0);
    const phoneMatch = pii.find((p) => p.type === "phone");
    expect(phoneMatch).toBeDefined();
    expect(phoneMatch?.value).toBe("+250788123456");
  });

  it("should extract multiple PII types", () => {
    const pii = extractPII("Contact +250788123456 at user@example.com");
    expect(pii.length).toBeGreaterThan(0);
  });

  it("should extract nothing from clean text", () => {
    const pii = extractPII("This is clean");
    expect(pii).toHaveLength(0);
  });
});
