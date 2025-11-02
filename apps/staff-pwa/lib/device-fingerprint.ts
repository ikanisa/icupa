function toHex(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  return Array.from(view)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeDeviceFingerprint(): Promise<string> {
  if (typeof window === "undefined") {
    return "server";
  }

  const navigatorInfo = window.navigator;
  const components = [
    navigatorInfo.userAgent ?? "unknown",
    navigatorInfo.language ?? "",
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    `${window.screen.width}x${window.screen.height}`,
    navigatorInfo.platform ?? "",
  ].join("|");

  if (!window.crypto?.subtle) {
    return components;
  }

  const encoder = new TextEncoder();
  const hash = await window.crypto.subtle.digest("SHA-256", encoder.encode(components));
  return toHex(hash);
}
