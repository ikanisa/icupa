/**
 * SDP (Session Description Protocol) utilities
 * Helper functions for handling SDP offers/answers in SIP sessions
 */

/**
 * Validate SDP offer format
 */
export function validateSdpOffer(sdp: string): boolean {
  if (!sdp || typeof sdp !== "string") {
    return false;
  }
  // Basic validation: should contain session description markers
  return sdp.includes("v=") && sdp.includes("m=");
}

/**
 * Extract media type from SDP
 */
export function extractMediaType(sdp: string): string | null {
  const mediaMatch = sdp.match(/m=(\w+)/);
  return mediaMatch ? mediaMatch[1] : null;
}

/**
 * Check if SDP contains audio
 */
export function hasAudio(sdp: string): boolean {
  return sdp.includes("m=audio");
}

/**
 * Extract codec preferences from SDP
 */
export function extractCodecs(sdp: string): string[] {
  const codecMatches = sdp.match(/a=rtpmap:\d+ (.+)/g);
  if (!codecMatches) return [];
  return codecMatches.map((match) => {
    const parts = match.split(" ");
    return parts.slice(1).join(" ").trim();
  });
}
