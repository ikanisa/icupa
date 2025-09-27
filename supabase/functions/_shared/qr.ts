const encoder = new TextEncoder();

export function base64UrlEncode(data: Uint8Array): string {
  const binary = Array.from(data)
    .map((byte) => String.fromCharCode(byte))
    .join("");
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  const padded = normalized + "=".repeat(padding);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function computeSignature(secret: string, message: string): Promise<string> {
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"]
  );

  const messageData = encoder.encode(message);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, messageData);
  return base64UrlEncode(new Uint8Array(signatureBuffer));
}

export function timingSafeEqual(expected: string, provided: string): boolean {
  try {
    const expectedBytes = base64UrlDecode(expected);
    const providedBytes = base64UrlDecode(provided);

    if (expectedBytes.length !== providedBytes.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < expectedBytes.length; i += 1) {
      result |= expectedBytes[i]! ^ providedBytes[i]!;
    }
    return result === 0;
  } catch (_error) {
    return false;
  }
}

export function sanitizeFingerprint(fingerprint: unknown): string | null {
  if (typeof fingerprint !== "string") {
    return null;
  }

  const trimmed = fingerprint.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 128);
}

export function encodeJson(value: Record<string, unknown>): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}
