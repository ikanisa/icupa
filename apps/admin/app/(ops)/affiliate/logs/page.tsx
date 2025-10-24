import { Badge, CardGlass, buttonClassName } from "@ecotrips/ui";
import { AffiliateOutboundInput } from "@ecotrips/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getOpsFunctionClient } from "../../../lib/functionClient";
import { logAdminAction } from "../../../lib/logging";
import { createAdminServerClient } from "../../../lib/supabaseServer";

import { OutboundForm, type AffiliateOutboundState } from "./OutboundForm";

type SearchParams = Record<string, string | string[] | undefined>;

type AffiliateEventRow = {
  id: string;
  created_at: string;
  direction: string;
  event_type: string;
  request_id: string | null;
  partner_slug: string;
  partner_name: string | null;
  signature_status: string;
  signature_error: string | null;
};

type LoadedEvents = {
  rows: AffiliateEventRow[];
  offline: boolean;
};

type PartnerOption = {
  slug: string;
  name: string | null;
  active: boolean;
};

const STATUS_OPTIONS = ["valid", "invalid", "missing", "skipped", "unknown"] as const;
const DIRECTION_OPTIONS = ["inbound", "outbound"] as const;

const outboundSchema = AffiliateOutboundInput.pick({ partner: true, event: true, note: true }).extend({
  payload: z.record(z.any()).default({}),
});

const filterSchema = z.object({
  partner: z.string().optional(),
  direction: z.enum(DIRECTION_OPTIONS).optional(),
  status: z.enum(STATUS_OPTIONS).optional(),
});

export default async function AffiliateLogsPage({ searchParams }: { searchParams?: SearchParams }) {
  const filters = parseFilters(searchParams);
  const supabase = await createAdminServerClient();
  const [events, partners] = await Promise.all([
    loadEvents(filters, supabase),
    loadPartners(supabase),
  ]);

  return (
    <div className="space-y-6">
      <CardGlass title="Affiliate events" subtitle="Monitor inbound partner webhooks and outbound simulations.">
        <Filters partners={partners} filters={filters} />
        {events.offline ? (
          <p className="mt-4 text-sm text-amber-200/80">Affiliate event view unavailable — verify Supabase session.</p>
        ) : events.rows.length === 0 ? (
          <p className="mt-4 text-sm text-white/70">No affiliate events recorded yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {events.rows.map((row) => (
              <EventRow key={row.id} row={row} />
            ))}
          </div>
        )}
      </CardGlass>
      <CardGlass title="Simulate outbound" subtitle="Generate mock notifications with HMAC signatures for partners.">
        <OutboundForm action={sendOutboundAction} />
        <p className="mt-4 text-xs text-white/60">
          Signatures use <code>sha256(timestamp + body)</code> with partner secrets. Docs in ops/affiliate-hmac.md.
        </p>
      </CardGlass>
    </div>
  );
}

async function sendOutboundAction(_: AffiliateOutboundState, formData: FormData): Promise<AffiliateOutboundState> {
  "use server";

  const partnerRaw = (formData.get("partner") ?? "").toString().trim().toLowerCase();
  const eventRaw = (formData.get("event") ?? "").toString().trim();
  const noteRaw = (formData.get("note") ?? "").toString().trim();
  const payloadRaw = (formData.get("payload") ?? "").toString().trim();

  const partnerSanitized = sanitizeSlug(partnerRaw);

  if (!partnerSanitized || !eventRaw) {
    return { status: "error", message: "Partner and event are required." };
  }

  let payload: Record<string, unknown> = {};
  if (payloadRaw) {
    try {
      const parsed = JSON.parse(payloadRaw);
      if (parsed && typeof parsed === "object") {
        payload = parsed as Record<string, unknown>;
      } else {
        return { status: "error", message: "Payload must be a JSON object." };
      }
    } catch (error) {
      console.error("affiliate.outbound.payload_parse", error);
      return { status: "error", message: "Payload JSON invalid." };
    }
  }

  const parsedInput = outboundSchema.safeParse({
    partner: partnerSanitized,
    event: eventRaw,
    note: noteRaw ? noteRaw : undefined,
    payload,
  });

  if (!parsedInput.success) {
    return { status: "error", message: "Validation failed." };
  }

  const client = await getOpsFunctionClient();
  if (!client) {
    logAdminAction("affiliate.outbound", { status: "offline" });
    return { status: "offline", message: "Supabase session missing. Sign in again." };
  }

  try {
    const response = await client.call("affiliate.outbound", { ...parsedInput.data, dryRun: true });
    if (!response.ok) {
      logAdminAction("affiliate.outbound", { status: "error", requestId: response.request_id });
      return { status: "error", message: response.error ?? "Edge function reported failure." };
    }
    logAdminAction("affiliate.outbound", {
      status: "success",
      requestId: response.request_id,
      eventId: response.event_id,
      partner: parsedInput.data.partner,
      signature: response.signature ?? null,
      note: parsedInput.data.note ?? null,
    });
    revalidatePath("/affiliate/logs");
    return {
      status: "success",
      message: response.signature ? `Signature ${response.signature}` : "Notification recorded.",
      detail: response.request_id ? `Request ${response.request_id}` : undefined,
    };
  } catch (error) {
    console.error("affiliate.outbound", error);
    logAdminAction("affiliate.outbound", { status: "error", error: error instanceof Error ? error.message : String(error) });
    return { status: "error", message: "Check withObs telemetry for details." };
  }
}

async function loadEvents(filters: FilterInput, supabase: Awaited<ReturnType<typeof createAdminServerClient>>): Promise<LoadedEvents> {
  if (!supabase) {
    return { rows: [], offline: true };
  }

  let query = supabase
    .from("affiliate.events_view")
    .select("id,created_at,direction,event_type,request_id,partner_slug,partner_name,signature_status,signature_error")
    .order("created_at", { ascending: false })
    .limit(50);

  if (filters.partner) {
    query = query.eq("partner_slug", filters.partner);
  }
  if (filters.direction) {
    query = query.eq("direction", filters.direction);
  }
  if (filters.status) {
    query = query.eq("signature_status", filters.status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("affiliate.events_view", error);
    return { rows: [], offline: true };
  }

  return { rows: Array.isArray(data) ? data : [], offline: false };
}

async function loadPartners(supabase: Awaited<ReturnType<typeof createAdminServerClient>>): Promise<PartnerOption[]> {
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("affiliate.partner")
    .select("slug,name,active")
    .order("slug", { ascending: true });

  if (error) {
    console.error("affiliate.partner", error);
    return [];
  }

  return Array.isArray(data)
    ? data.map((row) => ({ slug: row.slug, name: row.name, active: row.active }))
    : [];
}

type FilterInput = {
  partner?: string;
  direction?: (typeof DIRECTION_OPTIONS)[number];
  status?: (typeof STATUS_OPTIONS)[number];
};

function parseFilters(searchParams?: SearchParams): FilterInput {
  const partnerRaw = getSingle(searchParams?.partner);
  const directionRaw = getSingle(searchParams?.direction);
  const statusRaw = getSingle(searchParams?.status);

  const cleanedPartner = sanitizeSlug(partnerRaw);
  const cleaned = filterSchema.safeParse({
    partner: cleanedPartner,
    direction: sanitizeOption(directionRaw, DIRECTION_OPTIONS),
    status: sanitizeOption(statusRaw, STATUS_OPTIONS),
  });

  if (!cleaned.success) {
    return {
      partner: cleanedPartner,
      direction: sanitizeOption(directionRaw, DIRECTION_OPTIONS),
      status: sanitizeOption(statusRaw, STATUS_OPTIONS),
    };
  }

  return cleaned.data;
}

function getSingle(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
}

function sanitizeSlug(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return undefined;
  return trimmed.replace(/[^a-z0-9_-]/g, "");
}

function sanitizeOption<T extends readonly string[]>(
  value: string | undefined,
  options: T,
): T[number] | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  return options.find((option) => option === normalized) as T[number] | undefined;
}

type FiltersProps = {
  partners: PartnerOption[];
  filters: FilterInput;
};

function Filters({ partners, filters }: FiltersProps) {
  return (
    <form method="GET" className="mb-4 flex flex-wrap items-end gap-3">
      <label className="flex flex-col text-xs uppercase tracking-wide text-white/60">
        Partner
        <select name="partner" defaultValue={filters.partner ?? ""} className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white">
          <option value="">All partners</option>
          {partners.map((partner) => (
            <option key={partner.slug} value={partner.slug}>
              {partner.slug}
              {partner.name ? ` · ${partner.name}` : ""}
              {!partner.active ? " · inactive" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs uppercase tracking-wide text-white/60">
        Direction
        <select name="direction" defaultValue={filters.direction ?? ""} className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white">
          <option value="">All directions</option>
          {DIRECTION_OPTIONS.map((direction) => (
            <option key={direction} value={direction}>
              {direction}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs uppercase tracking-wide text-white/60">
        Signature
        <select name="status" defaultValue={filters.status ?? ""} className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={buttonClassName("glass")}>
        Apply filters
      </button>
    </form>
  );
}

type EventRowProps = {
  row: AffiliateEventRow;
};

function EventRow({ row }: EventRowProps) {
  const createdAt = formatTimestamp(row.created_at);
  const badgeTone = row.signature_status === "valid"
    ? "success"
    : row.signature_status === "invalid" || row.signature_status === "missing"
      ? "warning"
      : "info";

  return (
    <div className="rounded-2xl border border-white/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/60">{row.partner_slug}</p>
          <p className="text-sm text-white/80">
            {row.event_type}
            {row.partner_name ? ` · ${row.partner_name}` : ""}
          </p>
          <p className="text-xs text-white/60">{row.direction} · {createdAt}</p>
        </div>
        <Badge tone={badgeTone as "success" | "info" | "warning"}>{row.signature_status}</Badge>
      </div>
      {row.signature_error && (
        <p className="mt-2 text-xs text-amber-200/80">{row.signature_error}</p>
      )}
      {row.request_id && (
        <p className="mt-2 text-[11px] text-white/50">Request {row.request_id}</p>
      )}
    </div>
  );
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString().replace("T", " ").slice(0, 16);
}
