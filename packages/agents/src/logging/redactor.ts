const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /\+?\d[\d\s\-()]{7,}\d/g;
const CREDIT_CARD_REGEX = /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{3,4}\b/g;

export function redactPii(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(EMAIL_REGEX, "[redacted-email]")
      .replace(PHONE_REGEX, "[redacted-phone]")
      .replace(CREDIT_CARD_REGEX, "[redacted-card]");
  }

  if (Array.isArray(value)) {
    return value.map(redactPii);
  }

  if (value && typeof value === "object") {
    if (value instanceof Date) {
      return value;
    }
    return Object.entries(value as Record<string, unknown>).reduce(
      (acc, [key, val]) => {
        acc[key] = redactSensitiveKey(key, val);
        return acc;
      },
      {} as Record<string, unknown>
    );
  }

  return value;
}

function redactSensitiveKey(key: string, value: unknown): unknown {
  const sensitiveKeys = ["email", "phone", "ssn", "password", "token"];
  if (sensitiveKeys.some((sensitiveKey) => key.toLowerCase().includes(sensitiveKey))) {
    return "[redacted]";
  }
  return redactPii(value);
}
