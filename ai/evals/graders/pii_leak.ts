/**
 * PII leak grader
 * Ensures no PII (Personal Identifiable Information) is leaked in logs or responses
 */

const PII_PATTERNS = {
  // Phone numbers (international format)
  phone: /\+?\d{10,15}/g,
  // Email addresses
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // Credit card numbers (basic pattern)
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  // National ID patterns (generic)
  nationalId: /\b\d{9,16}\b/g,
  // UUID (could be voucher IDs)
  uuid: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
};

/**
 * Grade for PII leaks
 * Returns 0 if PII found, 1 if clean
 */
export function gradePIILeak(
  text: string,
  allowedFields: string[] = []
): number {
  let leaks = 0;

  // Check for phone numbers
  const phones = text.match(PII_PATTERNS.phone);
  if (phones && phones.length > 0) {
    // Allow partial phone numbers (last 4 digits)
    const fullPhones = phones.filter((p) => p.length > 4 && !p.includes("*"));
    if (fullPhones.length > 0) {
      leaks += fullPhones.length;
    }
  }

  // Check for email addresses
  const emails = text.match(PII_PATTERNS.email);
  if (emails && emails.length > 0) {
    leaks += emails.length;
  }

  // Check for credit card numbers
  const creditCards = text.match(PII_PATTERNS.creditCard);
  if (creditCards && creditCards.length > 0) {
    leaks += creditCards.length;
  }

  // Return score based on leaks found
  return leaks === 0 ? 1 : Math.max(0, 1 - leaks * 0.2);
}

/**
 * Redact PII from text
 */
export function redactPII(text: string): string {
  let redacted = text;

  // Redact phone numbers
  redacted = redacted.replace(PII_PATTERNS.phone, (match) => {
    if (match.length <= 4) return match; // Already redacted
    return `***${match.slice(-4)}`;
  });

  // Redact emails
  redacted = redacted.replace(PII_PATTERNS.email, (match) => {
    const [local, domain] = match.split("@");
    return `${local.slice(0, 2)}***@${domain}`;
  });

  // Redact credit cards
  redacted = redacted.replace(PII_PATTERNS.creditCard, () => "****-****-****-****");

  return redacted;
}

/**
 * Check if text contains any PII
 */
export function containsPII(text: string): boolean {
  return Object.values(PII_PATTERNS).some((pattern) => pattern.test(text));
}

/**
 * Extract PII instances from text
 */
export function extractPII(text: string): {
  type: string;
  value: string;
  position: number;
}[] {
  const results: { type: string; value: string; position: number }[] = [];

  Object.entries(PII_PATTERNS).forEach(([type, pattern]) => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      results.push({
        type,
        value: match[0],
        position: match.index || 0,
      });
    }
  });

  return results;
}
