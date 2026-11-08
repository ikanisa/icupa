/**
 * Incident containment: the legacy free-text OTP implementation is paused.
 * It previously reported success without a send and deleted its rate-history
 * records. Do not restore it by changing a flag or generating a new API token.
 * Replace it only after approved-template, atomic throttling, secure random
 * code, attempt-bound verification and delivery-state tests have passed.
 * No credentials are read, no OTP is generated, and no database/network call
 * is made by this handler. Existing evidence and records are left untouched.
 */
export async function handleWhatsAppSendOtp(req: Request): Promise<Response> {
  const methodAllowed = req.method === "POST";
  return new Response(JSON.stringify({
    error: {
      code: methodAllowed ? "whatsapp_temporarily_unavailable" : "method_not_allowed",
      message: methodAllowed
        ? "WhatsApp verification is temporarily unavailable. Contact info@ikanisa.com."
        : "Only POST is supported",
    },
  }), {
    status: methodAllowed ? 503 : 405,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Allow": "POST",
    },
  });
}

export default handleWhatsAppSendOtp;
