const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /\+?\d[\d\s().-]{7,}/g;

export function redactSensitiveText(input: string | null | undefined): string | undefined {
  if (!input) return undefined;

  return input
    .replace(EMAIL_REGEX, '[redacted-email]')
    .replace(PHONE_REGEX, (match) => '[redacted-phone:' + match.length + ']')
    .trim();
}

export function truncateForTelemetry(input: string | undefined, maxLength = 800): string | undefined {
  if (!input) return undefined;
  if (input.length <= maxLength) return input;
  return `${input.slice(0, maxLength)}…`;
}
