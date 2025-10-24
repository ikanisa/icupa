"use client";

import { useMemo, useState } from "react";

import { OptionCard, buttonClassName } from "@ecotrips/ui";
import { createEcoTripsFunctionClient } from "@ecotrips/api";
import type { EcoTripsClient } from "@ecotrips/api";
import type {
  AirPriceWatchInput,
  InventoryHoldInput,
  InventoryHoldResult,
  AirPriceWatchResult,
} from "@ecotrips/types";

type OptionDefinition = {
  id: string;
  title: string;
  subtitle: string;
  priceCents: number;
  currency: string;
  meta: { label: string; value: string; icon?: string }[];
  highlights: string[];
  holdPayload: Omit<InventoryHoldInput, "idempotency_key">;
  watchPayload: Omit<AirPriceWatchInput, "traveler_name" | "contact_email">;
};

type HoldState =
  | { state: "idle" }
  | { state: "pending" }
  | { state: "success"; details: Pick<InventoryHoldResult, "hold_ref" | "expires_at" | "source"> }
  | { state: "error"; message: string };

type WatchState =
  | { state: "idle" }
  | { state: "pending" }
  | { state: "success"; details: Pick<AirPriceWatchResult, "watch_id" | "submitted_at"> }
  | { state: "error"; message: string };

type OptionStatus = { hold: HoldState; watch: WatchState };

const optionCatalog: OptionDefinition[] = [
  {
    id: "akagera-kivu",
    title: "Akagera Dawn & Lake Kivu Glow",
    subtitle: "7 nights · Kigali in/out",
    priceCents: 345_000,
    currency: "USD",
    meta: [
      { label: "Nights", value: "7", icon: "🛏️" },
      { label: "Pace", value: "Balanced", icon: "🚶" },
      { label: "Carbon", value: "1.8t offset", icon: "🌱" },
      { label: "Supplier", value: "HBX-RWA-001", icon: "🏨" },
    ],
    highlights: [
      "Sunrise safari with conservation briefing in Akagera.",
      "Two-night floating lodge stay on Lake Kivu with kayaking clinics.",
      "Kigali art circuit and coffee cupping finale before departure.",
    ],
    holdPayload: {
      supplier_hotel_id: "HBX-RWA-001",
      plan_id: "DELUXE-RWA-001",
      check_in: "2025-07-04",
      check_out: "2025-07-11",
      pax: { adults: 2, children: 0 },
    },
    watchPayload: {
      origin: "KGL",
      destination: "EBB",
      departure_date: "2025-07-03",
      return_date: "2025-07-12",
      seats: 2,
      cabin: "economy",
      target_price_cents: 95_000,
      itinerary_id: "9b1a6b2a-6e2f-40a1-bf1b-9a4cbf0f7c10",
    },
  },
  {
    id: "volcanoes-nyungwe",
    title: "Volcanoes Summit & Nyungwe Canopy",
    subtitle: "8 nights · permits included",
    priceCents: 412_500,
    currency: "USD",
    meta: [
      { label: "Nights", value: "8", icon: "⏱️" },
      { label: "Pace", value: "Active", icon: "⛰️" },
      { label: "Carbon", value: "2.1t offset", icon: "🌍" },
      { label: "Supplier", value: "HBX-RWA-044", icon: "🏕️" },
    ],
    highlights: [
      "Golden monkey trek with ranger-led biodiversity briefing.",
      "Nyungwe canopy walk + tea cooperative dinner with storytellers.",
      "Renewal day in Kigali with spa recovery and impact salon.",
    ],
    holdPayload: {
      supplier_hotel_id: "HBX-RWA-044",
      plan_id: "PREMIUM-RWA-044",
      check_in: "2025-08-15",
      check_out: "2025-08-23",
      pax: { adults: 2, children: 1 },
    },
    watchPayload: {
      origin: "KGL",
      destination: "AMS",
      departure_date: "2025-08-13",
      return_date: "2025-08-24",
      seats: 3,
      cabin: "premium_economy",
      target_price_cents: 215_000,
      itinerary_id: "2f2e7a1c-c2d6-4fb0-94b8-dc6f0b0cb8f1",
    },
  },
];

const defaultStatuses: Record<string, OptionStatus> = optionCatalog.reduce(
  (acc, option) => {
    acc[option.id] = { hold: { state: "idle" }, watch: { state: "idle" } };
    return acc;
  },
  {} as Record<string, OptionStatus>,
);

export function ChatOptionBoard() {
  const functionClient = useMemo<EcoTripsClient | null>(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return null;
    }
    return createEcoTripsFunctionClient({
      supabaseUrl,
      anonKey,
      getAccessToken: async () => null,
    });
  }, []);

  const [travelerName, setTravelerName] = useState("Taylor Traveler");
  const [travelerEmail, setTravelerEmail] = useState("");
  const [statuses, setStatuses] = useState<Record<string, OptionStatus>>(defaultStatuses);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const upsertStatus = (optionId: string, next: Partial<OptionStatus>) => {
    setStatuses((prev) => ({
      ...prev,
      [optionId]: {
        hold: next.hold ?? prev[optionId]?.hold ?? { state: "idle" },
        watch: next.watch ?? prev[optionId]?.watch ?? { state: "idle" },
      },
    }));
  };

  const handleHold = async (option: OptionDefinition) => {
    upsertStatus(option.id, { hold: { state: "pending" } });
    if (!functionClient) {
      upsertStatus(option.id, {
        hold: { state: "error", message: "Supabase env vars missing" },
      });
      return;
    }

    const idempotencyKey = crypto.randomUUID();
    const payload: InventoryHoldInput = {
      ...option.holdPayload,
      idempotency_key: idempotencyKey,
    };

    try {
      const result = await functionClient.inventory.hold(payload, {
        idempotencyKey,
      });
      upsertStatus(option.id, {
        hold: {
          state: "success",
          details: {
            hold_ref: result.hold_ref,
            expires_at: result.expires_at,
            source: result.source,
          },
        },
      });
    } catch (error) {
      upsertStatus(option.id, {
        hold: {
          state: "error",
          message: (error as Error)?.message ?? "Hold failed",
        },
      });
    }
  };

  const handleWatch = async (option: OptionDefinition) => {
    if (!travelerEmail.trim()) {
      upsertStatus(option.id, {
        watch: { state: "error", message: "Add traveler email before watching fares" },
      });
      return;
    }

    upsertStatus(option.id, { watch: { state: "pending" } });
    if (!functionClient) {
      upsertStatus(option.id, {
        watch: { state: "error", message: "Supabase env vars missing" },
      });
      return;
    }

    const payload: AirPriceWatchInput = {
      ...option.watchPayload,
      traveler_name: travelerName.trim() || "Traveler",
      contact_email: travelerEmail.trim(),
    };

    try {
      const result = await functionClient.air.watch(payload);
      upsertStatus(option.id, {
        watch: {
          state: "success",
          details: {
            watch_id: result.watch_id,
            submitted_at: result.submitted_at,
          },
        },
      });
    } catch (error) {
      upsertStatus(option.id, {
        watch: {
          state: "error",
          message: (error as Error)?.message ?? "Watch request failed",
        },
      });
    }
  };

  const handleCompare = (option: OptionDefinition) => {
    setCompareIds((prev) => (prev.includes(option.id) ? prev : [...prev, option.id]));
    setCompareOpen(true);
  };

  const handleRemoveCompare = (optionId: string) => {
    setCompareIds((prev) => prev.filter((id) => id !== optionId));
  };

  const comparedOptions = optionCatalog.filter((option) => compareIds.includes(option.id));

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white backdrop-blur">
        <h2 className="text-base font-semibold tracking-tight">Traveler contact</h2>
        <p className="mt-1 text-sm text-white/70">
          Hold confirmations land instantly. Fare watches email when the ceiling price is met.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-white/70">Traveler name</span>
            <input
              value={travelerName}
              onChange={(event) => setTravelerName(event.target.value)}
              className="rounded-2xl border border-white/15 bg-slate-950/50 px-4 py-2 text-white outline-none focus:border-sky-400"
              placeholder="Taylor Traveler"
              type="text"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-white/70">Notification email</span>
            <input
              value={travelerEmail}
              onChange={(event) => setTravelerEmail(event.target.value)}
              className="rounded-2xl border border-white/15 bg-slate-950/50 px-4 py-2 text-white outline-none focus:border-sky-400"
              placeholder="you@example.com"
              type="email"
            />
          </label>
        </div>
        {!functionClient && (
          <p className="mt-3 text-xs text-amber-300/80">
            Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to activate live actions.
          </p>
        )}
      </section>

      {optionCatalog.map((option) => {
        const status = statuses[option.id] ?? { hold: { state: "idle" }, watch: { state: "idle" } };
        return (
          <OptionCard
            key={option.id}
            title={option.title}
            subtitle={option.subtitle}
            price={formatCurrency(option.priceCents, option.currency)}
            priceCaption="Total for party"
            meta={option.meta.map((entry) => ({
              label: entry.label,
              value: entry.value,
              icon: entry.icon,
            }))}
            highlights={option.highlights}
            actions={
              <>
                <button
                  type="button"
                  className={buttonClassName("primary")}
                  onClick={() => handleHold(option)}
                  disabled={status.hold.state === "pending"}
                >
                  {status.hold.state === "pending" ? "Holding…" : "Hold 15 minutes"}
                </button>
                <button
                  type="button"
                  className={buttonClassName("secondary")}
                  onClick={() => handleWatch(option)}
                  disabled={status.watch.state === "pending"}
                >
                  {status.watch.state === "pending" ? "Watching…" : "Watch fare"}
                </button>
                <button
                  type="button"
                  className={buttonClassName("glass")}
                  onClick={() => handleCompare(option)}
                >
                  Compare
                </button>
              </>
            }
          >
            <StatusSummary status={status} />
          </OptionCard>
        );
      })}

      {compareOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/80 px-4 py-6">
          <div className="w-full max-w-3xl rounded-3xl border border-white/15 bg-slate-900/95 p-6 text-white shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Compare itinerary options</h2>
                <p className="text-sm text-white/70">
                  Evaluate pace, carbon offsets, and supplier ids before committing to a hold.
                </p>
              </div>
              <button
                type="button"
                className={buttonClassName("glass")}
                onClick={() => setCompareOpen(false)}
              >
                Close
              </button>
            </div>
            {comparedOptions.length === 0 ? (
              <p className="mt-6 text-sm text-white/70">Add an option to compare from the chat cards.</p>
            ) : (
              <div className="mt-6 grid gap-4">
                {comparedOptions.map((option) => (
                  <div
                    key={option.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/90"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold">{option.title}</h3>
                        <p className="text-xs uppercase tracking-[0.35em] text-white/50">
                          {option.subtitle}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {formatCurrency(option.priceCents, option.currency)}
                        </p>
                        <button
                          type="button"
                          className="text-xs text-white/60 underline"
                          onClick={() => handleRemoveCompare(option.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                      <Metric label="Hold plan" value={option.holdPayload.plan_id} />
                      <Metric label="Supplier" value={option.holdPayload.supplier_hotel_id} />
                      <Metric
                        label="Target fare"
                        value={formatCurrency(
                          option.watchPayload.target_price_cents ?? 0,
                          option.currency,
                        )}
                      />
                      <Metric label="Departure" value={option.watchPayload.departure_date} />
                      <Metric label="Return" value={option.watchPayload.return_date ?? "Open"} />
                      <Metric
                        label="Cabin"
                        value={option.watchPayload.cabin.replace("_", " ")}
                      />
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusSummary({ status }: { status: OptionStatus }) {
  return (
    <div className="space-y-2 text-xs text-white/75">
      <div>
        <span className="font-semibold text-white">Hold:</span> {renderHoldStatus(status.hold)}
      </div>
      <div>
        <span className="font-semibold text-white">Fare watch:</span> {renderWatchStatus(status.watch)}
      </div>
    </div>
  );
}

function renderHoldStatus(status: HoldState) {
  if (status.state === "idle") return "Awaiting action";
  if (status.state === "pending") return "Creating hold…";
  if (status.state === "error") return `Error · ${status.message}`;
  const parts = [status.details.hold_ref && `Ref ${status.details.hold_ref}`];
  if (status.details.expires_at) {
    parts.push(`expires ${new Date(status.details.expires_at).toLocaleTimeString()}`);
  }
  if (status.details.source) {
    parts.push(`source ${status.details.source}`);
  }
  return parts.filter(Boolean).join(" · ");
}

function renderWatchStatus(status: WatchState) {
  if (status.state === "idle") return "Not tracking yet";
  if (status.state === "pending") return "Submitting watcher…";
  if (status.state === "error") return `Error · ${status.message}`;
  const fragments = [status.details.watch_id && `ID ${status.details.watch_id}`];
  if (status.details.submitted_at) {
    fragments.push(`queued ${new Date(status.details.submitted_at).toLocaleString()}`);
  }
  return fragments.filter(Boolean).join(" · ");
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.25em] text-white/60">{label}</dt>
      <dd className="mt-1 text-sm text-white">{value}</dd>
    </div>
  );
}

function formatCurrency(amountCents: number, currency: string) {
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return `${currency} –`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}
