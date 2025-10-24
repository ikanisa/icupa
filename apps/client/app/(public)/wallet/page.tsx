import { CardGlass, buttonClassName } from "@ecotrips/ui";
import { createEcoTripsFunctionClient } from "@ecotrips/api";
import {
  ConciergeDailyBriefQuery,
  ConciergeDailyBriefResponse,
  SafetyAdvisoryQuery,
  SafetyAdvisoryResponse,
  TimeToLeaveQuery,
  TimeToLeaveResponse,
} from "@ecotrips/types";

import { ConciergeDailyBriefs } from "../components/ConciergeDailyBriefs";
import { GroupSavingsChat } from "../components/GroupSavingsChat";
import { WalletOfflinePack } from "../components/WalletOfflinePack";
import { fallbackDailyBrief, fallbackSafety, fallbackTimeToLeave } from "./fixtures";

type WalletSignals = {
  dailyBrief: ConciergeDailyBriefResponse;
  timeToLeave: TimeToLeaveResponse;
  safety: SafetyAdvisoryResponse;
  offline: boolean;
  errors: string[];
};

async function loadWalletSignals(): Promise<WalletSignals> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return {
      dailyBrief: fallbackDailyBrief,
      timeToLeave: fallbackTimeToLeave,
      safety: fallbackSafety,
      offline: true,
      errors: ["Supabase credentials unavailable; using fixtures."],
    };
  }

  const client = createEcoTripsFunctionClient({
    supabaseUrl,
    anonKey,
    getAccessToken: async () => null,
  });

  try {
    const [dailyBrief, timeToLeave, safety] = await Promise.all([
      client.call("concierge.dailyBrief", {} as ConciergeDailyBriefQuery),
      client.call("concierge.timeToLeave", { upcoming: "1" } as TimeToLeaveQuery),
      client.call("concierge.safetyAdvisory", { channel: "wallet_modal" } as SafetyAdvisoryQuery),
    ]);

    const offline = [dailyBrief.source, timeToLeave.source, safety.source].some((source) =>
      typeof source === "string" ? source.includes("fixture") : false,
    );

    return { dailyBrief, timeToLeave, safety, offline, errors: [] };
  } catch (error) {
    console.error("wallet.load", error);
    return {
      dailyBrief: fallbackDailyBrief,
      timeToLeave: fallbackTimeToLeave,
      safety: fallbackSafety,
      offline: true,
      errors: ["Edge functions unavailable; showing concierge fixtures."],
    };
  }
}

export default async function WalletPage() {
  const { dailyBrief, timeToLeave, safety, offline, errors } = await loadWalletSignals();
  const timezone = dailyBrief.timezone ?? timeToLeave.timezone ?? "Africa/Kigali";

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 pb-24 pt-10">
      <CardGlass title="Wallet" subtitle="Offline pack caches itinerary JSON, QR tickets, concierge briefs, and emergency contacts.">
        <p className="text-sm text-white/80">
          Toggle INVENTORY_OFFLINE to force cached mode. Offline pack includes last synced itinerary, payment receipts, and
          WhatsApp emergency channels. Supply a privacy export request id to retrieve the signed offline bundle.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <WalletOfflinePack />
          <a href="/support" className={buttonClassName("secondary")}>
            View invoices
          </a>
        </div>
        {(offline || errors.length > 0) && (
          <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-xs text-amber-100">
            <p className="font-semibold uppercase tracking-wide text-amber-200">Fixture mode</p>
            <p className="mt-1">Concierge data served from wallet fixtures until Supabase session tokens are present.</p>
            {errors.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardGlass>

      <CardGlass
        title="Concierge daily briefs"
        subtitle="Preview the next itinerary days, then open modal details to broadcast via WhatsApp."
      >
        <ConciergeDailyBriefs briefs={dailyBrief.briefs} timezone={dailyBrief.timezone} offline={offline} />
      </CardGlass>

      <CardGlass
        title="Time to leave"
        subtitle="Departure buffers combine driver check-ins, road conditions, and safety advisories."
      >
        <DepartureList data={timeToLeave} timezone={timeToLeave.timezone ?? timezone} />
      </CardGlass>

      <CardGlass
        title="Safety advisories"
        subtitle="Wallet modals highlight route and weather advisories sourced from ConciergeGuide."
      >
        <SafetyAdvisoryList data={safety} timezone={timezone} />
      </CardGlass>

      <CardGlass
        title="Group savings chat"
        subtitle="ConciergeGuide nudges upcoming escrows and captures traveler confirmations for ops."
      >
        <GroupSavingsChat briefs={dailyBrief.briefs} timezone={timezone} />
      </CardGlass>
    </div>
  );
}

function DepartureList({ data, timezone }: { data: TimeToLeaveResponse; timezone?: string }) {
  if (!data.departures.length) {
    return <p className="text-sm text-white/70">No departures scheduled. ConciergeGuide will add transfers once confirmed.</p>;
  }

  return (
    <ul className="space-y-3">
      {data.departures.map((departure) => (
        <li key={departure.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-white">{departure.label}</p>
              <p className="text-xs uppercase tracking-wide text-white/50">{departure.status ?? "scheduled"}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-sky-200">{formatDateTimeString(departure.recommended_departure, timezone)}</p>
              <p className="text-xs text-white/50">
                Window ±{departure.window_minutes ?? 0}m · Buffer {departure.buffer_minutes ?? 0}m
              </p>
            </div>
          </div>
          {departure.pickup_point && <p className="mt-2 text-xs text-white/60">Pickup: {departure.pickup_point}</p>}
          {departure.transport && (
            <p className="mt-2 text-xs text-white/60">
              Driver {departure.transport.driver ?? "tbd"} · {departure.transport.vehicle ?? "vehicle tbd"}
              {departure.transport.contact_phone ? ` · ${departure.transport.contact_phone}` : ""}
            </p>
          )}
          {departure.notes && departure.notes.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-white/60">
              {departure.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function SafetyAdvisoryList({ data, timezone }: { data: SafetyAdvisoryResponse; timezone?: string }) {
  if (!data.advisories.length) {
    return <p className="text-sm text-white/70">No safety advisories flagged for this itinerary.</p>;
  }

  return (
    <ul className="space-y-3">
      {data.advisories.map((advisory) => (
        <li key={advisory.id} className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-50">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide text-amber-200">
            <span>{advisory.level}</span>
            <span>{formatWindow(advisory.effective_from, advisory.effective_to, timezone)}</span>
          </div>
          <p className="mt-2 text-base font-semibold text-amber-50">{advisory.title}</p>
          <p className="mt-2 text-sm text-amber-100/90">{advisory.summary}</p>
          <p className="mt-2 text-xs text-amber-100/80">{advisory.details}</p>
          {advisory.actions && advisory.actions.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-amber-100">
              {advisory.actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          )}
          {advisory.external_reference && (
            <a
              href={advisory.external_reference}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex text-xs font-semibold text-amber-200 underline"
            >
              View source
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function formatDateTimeString(input: string | undefined, timezone?: string) {
  if (!input) return "TBD";
  try {
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) return input;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone ?? "UTC",
    }).format(date);
  } catch (_error) {
    return input ?? "TBD";
  }
}

function formatWindow(from?: string, to?: string, timezone?: string) {
  if (!from && !to) return "Window pending";
  if (!from) return `Until ${formatDateTimeString(to, timezone)}`;
  if (!to) return `From ${formatDateTimeString(from, timezone)}`;
  return `${formatDateTimeString(from, timezone)} → ${formatDateTimeString(to, timezone)}`;
}
