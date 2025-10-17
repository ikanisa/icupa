import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type LeadPayload = {
  name?: string;
  email?: string;
  travelMonth?: string;
  groupType?: string;
  message?: string;
  consent?: boolean;
};

function invalid(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let payload: LeadPayload;
  try {
    payload = (await request.json()) as LeadPayload;
  } catch (error) {
    return invalid(`Invalid JSON payload: ${(error as Error).message}`);
  }

  const name = payload.name?.trim();
  const email = payload.email?.trim();
  const travelMonth = payload.travelMonth?.trim() ?? null;
  const groupType = payload.groupType?.trim() ?? null;
  const message = payload.message?.trim() ?? null;
  const consent = payload.consent === true;

  if (!name) return invalid("Name is required.");
  if (!email || !/.+@.+\..+/.test(email)) return invalid("Valid email is required.");
  if (!consent) return invalid("Consent is required.");

  if (!supabaseUrl || !serviceRole) {
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
    return NextResponse.json(
      {
        ok: true,
        leadName: name,
        fallback: "env_missing",
      },
      { status: 202 },
    );
  }

  const client = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });

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
    return invalid("Unable to save your request. Please try again shortly.", 503);
  }

  return NextResponse.json({ ok: true, leadName: name });
}
