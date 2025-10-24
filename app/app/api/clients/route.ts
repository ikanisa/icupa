import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database, Json } from "@ecotrips/types/supabase";
import { serverEnv } from "@/src/env";

export const runtime = "nodejs";

const ClientIntentSchema = z
  .object({
    kind: z.string().min(1, "intent_kind_required"),
    status: z.string().min(1).optional(),
    notes: z.string().optional(),
    partySize: z.number().int().positive().optional(),
    budgetMinCents: z.number().int().nonnegative().optional(),
    budgetMaxCents: z.number().int().nonnegative().optional(),
    travelWindow: z
      .object({
        start: z.string().min(1).optional(),
        end: z.string().min(1).optional(),
      })
      .partial()
      .optional(),
    destinations: z.array(z.string().min(1)).optional(),
    metadata: z.record(z.any()).optional(),
  })
  .strict();

const ClientCreateSchema = z
  .object({
    companyName: z.string().min(1, "company_name_required"),
    contactName: z.string().min(1).optional(),
    email: z.string().email(),
    phone: z.string().min(1).optional(),
    source: z.string().min(1).optional(),
    notes: z.string().optional(),
    utm: z
      .object({
        source: z.string().optional(),
        medium: z.string().optional(),
        campaign: z.string().optional(),
        term: z.string().optional(),
        content: z.string().optional(),
      })
      .partial()
      .optional(),
    metadata: z.record(z.any()).optional(),
    intent: ClientIntentSchema.optional(),
  })
  .strict();

type JsonObject = { [key: string]: Json };

type ClientsInsert = {
  id?: string;
  company_name: string;
  contact_name?: string | null;
  email: string;
  phone?: string | null;
  source?: string | null;
  notes?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  metadata?: JsonObject | null;
};

type ClientIntentsInsert = {
  id?: string;
  client_id: string;
  intent_kind: string;
  status?: string | null;
  notes?: string | null;
  metadata?: JsonObject | null;
};

type DatabaseWithClients = Database & {
  public: Database["public"] & {
    Tables: Database["public"]["Tables"] & {
      clients: {
        Row: ClientsInsert & { id: string; created_at: string; updated_at: string };
        Insert: ClientsInsert;
        Update: Partial<ClientsInsert>;
        Relationships: [];
      };
      client_intents: {
        Row: ClientIntentsInsert & { id: string; created_at: string; updated_at: string };
        Insert: ClientIntentsInsert;
        Update: Partial<ClientIntentsInsert>;
        Relationships: [];
      };
    };
  };
};

const supabase = createClient<DatabaseWithClients>(
  serverEnv.SUPABASE_URL,
  serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  },
);

type ClientPayload = z.infer<typeof ClientCreateSchema>;

type IntentPayload = NonNullable<ClientPayload["intent"]>;

function normalizeString(value: string | null | undefined) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildClientRecord(payload: ClientPayload): ClientsInsert {
  return {
    company_name: payload.companyName.trim(),
    contact_name: normalizeString(payload.contactName),
    email: payload.email.trim().toLowerCase(),
    phone: normalizeString(payload.phone ?? null),
    source: normalizeString(payload.source),
    notes: normalizeString(payload.notes ?? null),
    utm_source: normalizeString(payload.utm?.source),
    utm_medium: normalizeString(payload.utm?.medium),
    utm_campaign: normalizeString(payload.utm?.campaign),
    utm_term: normalizeString(payload.utm?.term),
    utm_content: normalizeString(payload.utm?.content),
    metadata: buildClientMetadata(payload),
  };
}

function sanitizeJsonValue(value: unknown): Json | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    const sanitizedArray = value
      .map((entry) => sanitizeJsonValue(entry))
      .filter((entry): entry is Json => entry !== undefined);
    if (sanitizedArray.length === 0) return undefined;
    return sanitizedArray as Json;
  }

  if (typeof value === "object") {
    const sanitizedObject = Object.entries(value as Record<string, unknown>).reduce<JsonObject>(
      (acc, [key, entry]) => {
        const sanitized = sanitizeJsonValue(entry);
        if (sanitized !== undefined) {
          acc[key] = sanitized;
        }
        return acc;
      },
      {},
    );

    if (Object.keys(sanitizedObject).length === 0) return undefined;
    return sanitizedObject as Json;
  }

  return undefined;
}

function normalizeMetadata(input: Record<string, unknown> | undefined): JsonObject | null {
  if (!input) return null;

  const cleaned = Object.entries(input).reduce<JsonObject>((acc, [key, value]) => {
    const sanitized = sanitizeJsonValue(value);
    if (sanitized !== undefined) {
      acc[key] = sanitized;
    }
    return acc;
  }, {});

  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

function buildIntentRecord(payload: IntentPayload, clientId: string): ClientIntentsInsert {
  const metadata = normalizeMetadata({
    ...payload.metadata,
    partySize: payload.partySize,
    budgetMinCents: payload.budgetMinCents,
    budgetMaxCents: payload.budgetMaxCents,
    travelWindow: payload.travelWindow,
    destinations: payload.destinations,
  });

  return {
    client_id: clientId,
    intent_kind: payload.kind,
    status: normalizeString(payload.status ?? null),
    notes: normalizeString(payload.notes ?? null),
    metadata,
  };
}

function buildClientMetadata(payload: ClientPayload): JsonObject | null {
  return normalizeMetadata(payload.metadata);
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "WARN",
        event: "clients.payload.invalid_json",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json({ ok: false, message: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = ClientCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Validation failed.",
        errors: parsed.error.issues.map((issue) => issue.message),
      },
      { status: 400 },
    );
  }

  const clientRecord = buildClientRecord(parsed.data);
  const { data: clientData, error: clientError } = await supabase
    .from("clients")
    .insert(clientRecord)
    .select("id")
    .single();

  if (clientError || !clientData) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        event: "clients.insert_failed",
        message: clientError?.message ?? "Unknown error",
        code: clientError?.code,
      }),
    );
    return NextResponse.json(
      { ok: false, message: "Failed to create client." },
      { status: 500 },
    );
  }

  let intentId: string | null = null;
  if (parsed.data.intent) {
    const intentRecord = buildIntentRecord(parsed.data.intent, clientData.id);
    const { data: intentData, error: intentError } = await supabase
      .from("client_intents")
      .insert(intentRecord)
      .select("id")
      .single();

    if (intentError || !intentData) {
      console.error(
        JSON.stringify({
          level: "ERROR",
          event: "clients.intent_insert_failed",
          message: intentError?.message ?? "Unknown error",
          code: intentError?.code,
        }),
      );

      const { error: rollbackError } = await supabase.from("clients").delete().eq("id", clientData.id);
      if (rollbackError) {
        console.error(
          JSON.stringify({
            level: "ERROR",
            event: "clients.rollback_failed",
            message: rollbackError.message,
            code: rollbackError.code,
            clientId: clientData.id,
          }),
        );
      }

      return NextResponse.json(
        {
          ok: false,
          message: "Failed to create client intent.",
        },
        { status: 500 },
      );
    }

    intentId = intentData.id;
  }

  return NextResponse.json(
    { ok: true, clientId: clientData.id, intentId },
    { status: 201 },
  );
}
