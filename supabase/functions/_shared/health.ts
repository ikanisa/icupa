import { healthResponse } from "../_obs/withObs.ts";

export function maybeHandleHealth(req: Request, fn: string): Response | null {
  if (req.method !== "GET") {
    return null;
  }

  try {
    const url = new URL(req.url);
    if (url.pathname.endsWith("/health")) {
      return healthResponse(fn);
    }
  } catch (_error) {
    // If URL construction fails just ignore and continue with main handler.
  }

  return null;
}
