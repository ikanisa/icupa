import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") ?? "465");
const SMTP_USER = Deno.env.get("SMTP_USER") ?? "";
const SMTP_PASS = Deno.env.get("SMTP_PASS") ?? "";
const SMTP_FROM = Deno.env.get("SMTP_FROM") ?? "";

const ADMIN_DOMAINS = (Deno.env.get("ADMIN_EMAIL_DOMAINS") ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
const MAGICLINK_REDIRECT = Deno.env.get("ADMIN_MAGICLINK_REDIRECT") ?? "https://admin.icupa.app/login/callback";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  console.error("Supabase configuration missing for admin_email_magiclink");
}

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse({ error: { code, message } }, status);
}

function validateEmail(email?: string | null): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  if (!/^[^@]+@[^@]+$/.test(trimmed)) {
    return null;
  }
  const domain = trimmed.split("@").pop() ?? "";
  if (ADMIN_DOMAINS.length > 0 && !ADMIN_DOMAINS.includes(domain)) {
    return null;
  }
  return trimmed;
}

async function sendMagicLinkEmail(to: string, link: string, otp: string) {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    console.error("SMTP configuration missing; cannot send admin magic link email");
    throw new Error("Email transport not configured");
  }

  const client = new SmtpClient();
  try {
    await client.connectTLS({ hostname: SMTP_HOST, port: SMTP_PORT, username: SMTP_USER, password: SMTP_PASS });
    await client.send({
      from: SMTP_FROM,
      to,
      subject: "Your ICUPA admin magic link",
      content: `Hello,\n\nUse this secure link to access the ICUPA admin console:\n${link}\n\nIf prompted for a code, enter: ${otp}\n\nThis link expires shortly. If you did not request it, you can ignore this email.\n\n— ICUPA`,
    });
  } finally {
    await client.close();
  }
}

export async function handleAdminEmailMagiclink(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST is supported");
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  try {
    const body = (await req.json()) as { email?: string };
    const email = validateEmail(body.email);

    if (!email) {
      return errorResponse(400, "invalid_email", "Provide an allowed admin email address");
    }

    const linkResponse = await serviceClient.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: MAGICLINK_REDIRECT,
      },
    });

    if (linkResponse.error || !linkResponse.data?.properties) {
      console.error("generateLink failed", linkResponse.error);
      return errorResponse(500, "link_failed", "Unable to generate magic link");
    }

    const { action_link, email_otp } = linkResponse.data.properties;

    try {
      await sendMagicLinkEmail(email, action_link, email_otp);
    } catch (emailError) {
      console.error("Failed to send admin magic link email", emailError);
      return errorResponse(500, "email_failed", "Unable to send magic link email");
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Unexpected error in admin_email_magiclink", error);
    return errorResponse(500, "unexpected_error", "Unexpected error");
  }
}

export default handleAdminEmailMagiclink;
