// Simple PII redaction helper. Use before persisting user inputs/outputs to telemetry or logs.
// Extend regexes to match your threat model. Keep raw transcripts only in highly-protected stores.

export function redactPII(text: string | undefined | null): string | null {
  if (!text) return null;
  let out = String(text);

  // Long tokens (API keys) — heuristic (check first to avoid false positives with phone regex)
  out = out.replace(/\b(sk|api|key)[-_]?[A-Za-z0-9]{16,}\b/gi, '[REDACTED_TOKEN]');

  // Phone numbers (simple international/local match)
  out = out.replace(/\+?\d[\d\s-]{6,}\d/g, '[REDACTED_PHONE]');

  // Emails
  out = out.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]');

  return out;
}
