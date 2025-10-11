import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleWhatsAppSendOtp } from "./whatsapp_send_otp/index.ts";
import { handleWhatsAppVerifyOtp } from "./whatsapp_verify_otp/index.ts";
import { handleWhatsAppWebhook } from "./whatsapp_webhook/index.ts";
import { handleAdminEmailMagiclink } from "./admin_email_magiclink/index.ts";

function extractSubPath(req: Request, prefix: string): string | null {
  const url = new URL(req.url);
  let basePath = url.pathname.replace(/^\/?functions\/v1\//, "");
  basePath = basePath.replace(/^\/+/, "");
  if (!basePath.startsWith(prefix)) {
    return null;
  }
  const remainder = basePath.slice(prefix.length);
  return remainder.replace(/^\/+/, "");
}

serve(async (req) => {
  const subPath = extractSubPath(req, "auth");
  switch (subPath) {
    case "whatsapp_send_otp":
      return handleWhatsAppSendOtp(req);
    case "whatsapp_verify_otp":
      return handleWhatsAppVerifyOtp(req);
    case "whatsapp_webhook":
      return handleWhatsAppWebhook(req);
    case "admin_email_magiclink":
      return handleAdminEmailMagiclink(req);
    default:
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
  }
});
