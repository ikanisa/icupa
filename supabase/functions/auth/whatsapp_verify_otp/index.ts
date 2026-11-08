/**
 * Recovery containment: legacy WhatsApp verification is intentionally paused.
 * Pair with the paused whatsapp_send_otp endpoint. No credential reads, OTP
 * lookups, user/tenant creation, role grants, session issuance or provider calls.
 * This does NOT revoke sessions already issued by an earlier deployment.
 */
export async function handleWhatsAppVerifyOtp(req: Request): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Allow": "POST",
  };
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: { code: "method_not_allowed", message: "Only POST is supported" } }), { status: 405, headers });
  }
  // Do not read even a malformed/streaming body: the route is unavailable,
  // independent of phone, code, account existence or environment settings.
  return new Response(JSON.stringify({
    error: {
      code: "whatsapp_verification_unavailable",
      message: "WhatsApp sign-in is temporarily unavailable. Contact support.",
    },
    support_email: "info@ikanisa.com",
  }), { status: 503, headers });
}
export default handleWhatsAppVerifyOtp;
