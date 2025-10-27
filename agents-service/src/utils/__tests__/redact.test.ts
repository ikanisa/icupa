import { describe, expect, it } from "vitest";
import { redactPII } from "../redact";

describe("redactPII", () => {
  it("returns null for undefined or null input", () => {
    expect(redactPII(undefined)).toBe(null);
    expect(redactPII(null)).toBe(null);
  });

  it("redacts phone numbers", () => {
    expect(redactPII("Call me at +1-555-123-4567")).toBe("Call me at [REDACTED_PHONE]");
    expect(redactPII("My number is 555 123 4567")).toBe("My number is [REDACTED_PHONE]");
    expect(redactPII("Phone: +44 20 1234 5678")).toBe("Phone: [REDACTED_PHONE]");
  });

  it("redacts email addresses", () => {
    expect(redactPII("Contact john.doe@example.com for info")).toBe(
      "Contact [REDACTED_EMAIL] for info"
    );
    expect(redactPII("Email: alice+test@company.org")).toBe("Email: [REDACTED_EMAIL]");
  });

  it("redacts API keys and tokens", () => {
    expect(redactPII("Use key sk-1234567890abcdefghij")).toBe("Use key [REDACTED_TOKEN]");
    expect(redactPII("API token: api_key123456789012345678")).toBe(
      "API token: [REDACTED_TOKEN]"
    );
    expect(redactPII("Secret: key-abcdefghijklmnopqrstuvwxyz")).toBe(
      "Secret: [REDACTED_TOKEN]"
    );
  });

  it("redacts multiple PII types in the same string", () => {
    const input = "Call +1-555-1234 or email john@example.com with key sk-abc123456789012345";
    const expected =
      "Call [REDACTED_PHONE] or email [REDACTED_EMAIL] with key [REDACTED_TOKEN]";
    expect(redactPII(input)).toBe(expected);
  });

  it("preserves text without PII", () => {
    expect(redactPII("This is a normal message")).toBe("This is a normal message");
    expect(redactPII("Order #12345 for table 7")).toBe("Order #12345 for table 7");
  });

  it("handles empty strings", () => {
    expect(redactPII("")).toBe(null);
  });
});
