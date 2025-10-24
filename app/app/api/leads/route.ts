import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { enforceLeadRateLimit, type RateLimitOutcome } from "./rate-limit";

type LeadPayload = {
  name?: string;
  email?: string;
  travelMonth?: string;
  groupType?: string;
  message?: string;
  consent?: boolean;
  captchaToken?: string;
};

function invalid(message: string, status = 400, headers?: HeadersInit) {
  return NextResponse.json({ ok: false, message }, { status, headers });
}

type AuditKind = "accepted" | "rejected";

type AuditEvent = {
  kind: AuditKind;
  reason: string;
  leadName?: string | null;
  leadEmail?: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata?: Record<string, unknown> | null;
};

async function persistAudit(
  client: SupabaseClient | null,
  event: AuditEvent,
): Promise<void> {
  const record = {
    event_type: event.kind,
    reason: event.reason,
    lead_name: event.leadName ?? null,
    lead_email: event.leadEmail ?? null,
    ip: event.ip,
    user_agent: event.userAgent,
    metadata: event.metadata ?? null,
  };

  const log = {
    level: event.kind === "accepted" ? "INFO" : "WARN",
    event: `marketing.lead.${event.kind}`,
    ...record,
  };

  if (!client) {
    const logger = event.kind === "accepted" ? console.log : console.warn;
    logger(JSON.stringify({ ...log, persisted: false }));
    return;
  }

  const { error } = await client.from("marketing_lead_audit_events").insert(record);
  if (error) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        event: "marketing.lead.audit_failed",
        message: error.message,
        code: error.code,
        record,
      }),
    );
  }
}

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const [first] = forwarded.split(",");
    if (first) return first.trim();
  }

  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();

  return null;
}

function headersFromRateLimit(result: RateLimitOutcome | null): HeadersInit | undefined {
  if (!result) return undefined;
  const secondsUntilReset = Math.ceil(Math.max(0, result.reset - Date.now()) / 1000);
  const headers = new Headers();
  headers.set("RateLimit-Limit", String(result.limit));
  headers.set("RateLimit-Remaining", String(Math.max(0, result.remaining)));
  headers.set("RateLimit-Reset", String(Math.max(0, secondsUntilReset)));
  if (!result.allowed && result.retryAfter !== null) {
    headers.set("Retry-After", String(Math.ceil(result.retryAfter / 1000)));
  }
  headers.set("RateLimit-Source", result.source);
  return headers;
}

type CaptchaVerification = {
  ok: boolean;
  reason?: string;
};

async function verifyCaptchaToken(token: string | undefined, ip: string | null): Promise<CaptchaVerification> {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const debugBypass =
    process.env.LEADS_CAPTCHA_DEBUG_BYPASS_TOKEN ??
    (nodeEnv === "production" ? undefined : "debug-ok");
  const debugFail =
    process.env.LEADS_CAPTCHA_DEBUG_FAIL_TOKEN ??
    (nodeEnv === "production" ? undefined : "debug-fail");
  const secret = process.env.LEADS_CAPTCHA_SECRET;
  const required = process.env.LEADS_CAPTCHA_REQUIRED === "true";

  if (debugBypass && token === debugBypass) {
    return { ok: true, reason: "debug_bypass" };
  }

  if (debugFail && token === debugFail) {
    return { ok: false, reason: "debug_forced_failure" };
  }

  if (!secret) {
    if (required && !token) {
      return { ok: false, reason: "captcha_required" };
    }
    if (required) {
      return { ok: false, reason: "captcha_unconfigured" };
    }
    return { ok: true, reason: "not_configured" };
  }

  if (!token) {
    return { ok: false, reason: "missing_token" };
  }

  const endpoint =
    process.env.LEADS_CAPTCHA_VERIFY_URL ?? "https://challenges.cloudflare.com/turnstile/v0/siteverify";

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    if (!response.ok) {
      return { ok: false, reason: `http_${response.status}` };
    }

    const data = (await response.json()) as { success?: boolean; [key: string]: unknown };
    if (data.success === true) {
      return { ok: true };
    }

    const errorCodes = Array.isArray((data as { "error-codes"?: unknown })["error-codes"])
      ? ((data as { "error-codes"?: string[] })["error-codes"] ?? []).join(",")
      : undefined;

    return { ok: false, reason: errorCodes ?? "captcha_failed" };
  } catch (error) {
    return { ok: false, reason: (error as Error).message };
  }
}

type MissingCredentialAlert = {
  missingSecrets: string[];
  leadEmailDomain: string;
};

const missingSupabaseAlertWebhookUrl =
  process.env.SUPABASE_MISSING_CREDENTIALS_ALERT_WEBHOOK_URL;

async function alertMissingSupabaseCredentials(
  payload: MissingCredentialAlert,
) {
  if (!missingSupabaseAlertWebhookUrl) return;

  try {
    await fetch(missingSupabaseAlertWebhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        level: "FATAL",
        event: "marketing.lead.supabase_credentials_missing",
        ...payload,
      }),
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        event: "marketing.lead.alert_dispatch_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent");
  const client =
    supabaseUrl && serviceRole
      ? createClient(supabaseUrl, serviceRole, {
          auth: { persistSession: false },
        })
      : null;

  let rateLimitHeaders: HeadersInit | undefined;

  try {
    const rateResult = await enforceLeadRateLimit(ip ?? "anonymous");
    rateLimitHeaders = headersFromRateLimit(rateResult);
    if (!rateResult.allowed) {
      await persistAudit(client, {
        kind: "rejected",
        reason: "rate_limited",
        ip,
        userAgent,
        metadata: {
          limit: rateResult.limit,
          remaining: rateResult.remaining,
          retryAfterMs: rateResult.retryAfter,
          source: rateResult.source,
        },
      });
      return NextResponse.json(
        { ok: false, message: "Too many submissions. Please wait a moment and try again." },
        { status: 429, headers: rateLimitHeaders },
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        event: "marketing.lead.rate_limit_failed",
        message: (error as Error).message,
      }),
    );
  }

  // Parse JSON safely
  let payload: LeadPayload;
  try {
    payload = (await request.json()) as LeadPayload;
  } catch (error) {
    await persistAudit(client, {
      kind: "rejected",
      reason: "invalid_json",
      ip,
      userAgent,
      metadata: { message: (error as Error).message },
    });
    return invalid(`Invalid JSON payload: ${(error as Error).message}`, 400, rateLimitHeaders);
  }

  // Normalize & validate
  const name = payload.name?.trim();
  const email = payload.email?.trim();
  const travelMonth = payload.travelMonth?.trim() ?? null;
  const groupType = payload.groupType?.trim() ?? null;
  const message = payload.message?.trim() ?? null;
  const consent = payload.consent === true;
  const captchaToken = payload.captchaToken;

  if (!name) {
    await persistAudit(client, {
      kind: "rejected",
      reason: "missing_name",
      ip,
      userAgent,
      leadEmail: email ?? null,
    });
    return invalid("Name is required.", 400, rateLimitHeaders);
  }
  if (!email || !/.+@.+\..+/.test(email)) {
    await persistAudit(client, {
      kind: "rejected",
      reason: "invalid_email",
      ip,
      userAgent,
      leadName: name,
      leadEmail: email ?? null,
    });
    return invalid("Valid email is required.", 400, rateLimitHeaders);
  }
  if (!consent) {
    await persistAudit(client, {
      kind: "rejected",
      reason: "consent_missing",
      ip,
      userAgent,
      leadName: name,
      leadEmail: email,
    });
    return invalid("Consent is required.", 400, rateLimitHeaders);
  }

  const captcha = await verifyCaptchaToken(captchaToken, ip);
  if (!captcha.ok) {
    await persistAudit(client, {
      kind: "rejected",
      reason: "captcha_failed",
      ip,
      userAgent,
      leadName: name,
      leadEmail: email,
      metadata: { captchaReason: captcha.reason },
    });
    return invalid("Captcha verification failed. Please try again.", 400, rateLimitHeaders);
  }

  // Graceful fallback if env is missing (kept from main)
  if (!client) {
    const emailDomain = email.includes("@") ? email.split("@").pop() ?? "" : "";
    console.warn(
      JSON.stringify({
        level: "WARN",
        event: "marketing.lead.fallback",
        message: "Supabase credentials missing; returning synthetic success response.",
        hasUrl: Boolean(supabaseUrl),
        hasServiceRole: Boolean(serviceRole),
        leadEmailDomain: emailDomain,
      }),
    );
    const missingSecrets = [
      supabaseUrl ? undefined : "SUPABASE_URL",
      serviceRole ? undefined : "SUPABASE_SERVICE_ROLE_KEY",
    ].filter((value): value is string => Boolean(value));

    console.error(
      JSON.stringify({
        level: "ERROR",
        event: "marketing.lead.supabase_credentials_missing",
        message: "Supabase credentials missing; failing request.",
        missingSecrets,
        leadEmailDomain: emailDomain,
      }),
    );

    await alertMissingSupabaseCredentials({
      leadEmailDomain: emailDomain,
      missingSecrets,
    });

    if (process.env.__LEGACY_SUPABASE_FALLBACK === "true") {
      return NextResponse.json(
        { ok: true, leadName: name, fallback: "env_missing" },
        { status: 202 },
      );
    }

    return invalid(
      "We're experiencing configuration issues. Please try again in a few minutes.",
      503,
    );
  }

  const { error } = await client.from("marketing_leads").insert({
    name,
    email,
    travel_month: travelMonth,
    group_type: groupType,
    message,
    consent_captured: consent,
    source: "marketing_site",
  });

  if (error) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        event: "marketing.lead.insert_failed",
        message: error.message,
        code: error.code,
      }),
    );
    await persistAudit(client, {
      kind: "rejected",
      reason: "insert_failed",
      ip,
      userAgent,
      leadName: name,
      leadEmail: email,
      metadata: { code: error.code, message: error.message },
    });
    return invalid("Unable to save your request. Please try again shortly.", 503, rateLimitHeaders);
  }

  await persistAudit(client, {
    kind: "accepted",
    reason: "stored",
    ip,
    userAgent,
    leadName: name,
    leadEmail: email,
    metadata: { travelMonth, groupType },
  });

  return NextResponse.json({ ok: true, leadName: name }, { headers: rateLimitHeaders });
}
