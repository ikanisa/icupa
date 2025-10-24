"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CardGlass } from "@ecotrips/ui";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@ecotrips/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type ComponentClient = SupabaseClient<Database>;

interface GroupLiveSlotsPanelProps {
  itineraryId: string;
}

type LiveSlotCounts = {
  escrowId: string;
  groupId: string;
  itineraryId: string | null;
  totalSlots: number;
  filledSlots: number;
  availableSlots: number;
  waitlistSlots: number;
  presenceOptIn: number;
  presenceVisible: number;
  presenceOnline: number;
  visible: boolean;
  updatedAt: string;
};

type HighlightState = Record<string, boolean>;

const METRICS: Array<{
  key: keyof LiveSlotCounts;
  label: string;
  description: string;
}> = [
  {
    key: "filledSlots",
    label: "Contributors",
    description: "Members who have already contributed",
  },
  {
    key: "availableSlots",
    label: "Open slots",
    description: "Remaining seats before the minimum threshold",
  },
  {
    key: "waitlistSlots",
    label: "Waitlist",
    description: "Overflow beyond the minimum slots",
  },
  {
    key: "presenceVisible",
    label: "Visible travelers",
    description: "Travelers sharing real-time presence",
  },
  {
    key: "presenceOnline",
    label: "Online now",
    description: "Visible travelers currently online",
  },
];

function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function mapRow(row: Record<string, unknown>): LiveSlotCounts {
  return {
    escrowId: String(row.escrow_id ?? ""),
    groupId: String(row.group_id ?? ""),
    itineraryId: typeof row.itinerary_id === "string" ? row.itinerary_id : null,
    totalSlots: Number(row.total_slots ?? 0),
    filledSlots: Number(row.filled_slots ?? 0),
    availableSlots: Number(row.available_slots ?? 0),
    waitlistSlots: Number(row.waitlist_slots ?? 0),
    presenceOptIn: Number(row.presence_opt_in ?? 0),
    presenceVisible: Number(row.presence_visible ?? 0),
    presenceOnline: Number(row.presence_online ?? 0),
    visible: Boolean(row.visible ?? true),
    updatedAt: typeof row.updated_at === "string"
      ? row.updated_at
      : new Date().toISOString(),
  };
}

export function GroupLiveSlotsPanel({ itineraryId }: GroupLiveSlotsPanelProps) {
  const [counts, setCounts] = useState<LiveSlotCounts | null>(null);
  const [highlights, setHighlights] = useState<HighlightState>({});
  const [loading, setLoading] = useState(true);
  const [configMissing, setConfigMissing] = useState(false);
  const previousRef = useRef<LiveSlotCounts | null>(null);
  const timeoutsRef = useRef<Record<string, number>>({});

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabase = useMemo<ComponentClient | null>(() => {
    if (!supabaseUrl || !anonKey) {
      return null;
    }

    return createClientComponentClient<Database>({
      supabaseUrl,
      supabaseKey: anonKey,
    });
  }, [supabaseUrl, anonKey]);

  useEffect(() => {
    if (!supabaseUrl || !anonKey) {
      setConfigMissing(true);
    }
  }, [supabaseUrl, anonKey]);

  useEffect(() => {
    if (!supabase) return;
    if (!itineraryId) return;

    let cancelled = false;

    async function bootstrap(client: ComponentClient) {
      setLoading(true);
      const { data, error } = await client
        .schema("group")
        .from("live_slots")
        .select("*")
        .eq("itinerary_id", itineraryId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (error && error.code !== "PGRST116") {
        console.error("group.live_slots.bootstrap", error);
        setLoading(false);
        return;
      }

      if (data) {
        applyCounts(mapRow(data));
      }
      setLoading(false);
    }

    const client = supabase;
    bootstrap(client);

    const channel = client.channel(REALTIME_CHANNEL_KEY)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "group",
          table: "live_slots",
          filter: `itinerary_id=eq.${itineraryId}`,
        },
        (payload) => {
          if (!payload.new) return;
          applyCounts(mapRow(payload.new as Record<string, unknown>));
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void client.functions.invoke("live-slots-update", {
            body: { itinerary_id: itineraryId },
          }).catch((error) => {
            console.error("live-slots-update.invoke", error);
          });
        }
      });

    return () => {
      cancelled = true;
      channel.unsubscribe().catch(() => undefined);
      Object.values(timeoutsRef.current).forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      timeoutsRef.current = {};
    };
  }, [supabase, itineraryId]);

  const applyCounts = (next: LiveSlotCounts) => {
    setCounts(next);
    const previous = previousRef.current;
    previousRef.current = next;

    if (!previous) return;

    for (const metric of METRICS) {
      const key = metric.key;
      const prevValue = previous[key];
      const nextValue = next[key];
      if (typeof prevValue === "number" && typeof nextValue === "number" && prevValue !== nextValue) {
        triggerHighlight(String(key));
      }
    }
  };

  const triggerHighlight = (key: string) => {
    setHighlights((state) => ({ ...state, [key]: true }));
    if (timeoutsRef.current[key]) {
      clearTimeout(timeoutsRef.current[key]);
    }
    timeoutsRef.current[key] = window.setTimeout(() => {
      setHighlights((state) => ({ ...state, [key]: false }));
      delete timeoutsRef.current[key];
    }, 700);
  };

  return (
    <CardGlass
      title="Live slots"
      subtitle="Realtime group availability and traveler presence updates."
    >
      <div className="space-y-4 text-sm text-white/80">
        {configMissing && (
          <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            Configure <code className="mx-1 rounded bg-black/40 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and
            <code className="mx-1 rounded bg-black/40 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable realtime counters.
          </p>
        )}
        {loading && (
          <p className="text-white/70">Preparing live slot telemetry…</p>
        )}
        {counts && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {METRICS.map((metric) => {
              const value = counts[metric.key];
              const isHighlighted = highlights[String(metric.key)];
              return (
                <div
                  key={metric.key as string}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">{metric.label}</p>
                  <p
                    className={classNames(
                      "mt-2 text-3xl font-semibold transition-transform duration-500",
                      isHighlighted && "scale-110 text-sky-300",
                    )}
                  >
                    {typeof value === "number" ? value : "—"}
                  </p>
                  <p className="mt-1 text-xs text-white/60">{metric.description}</p>
                </div>
              );
            })}
          </div>
        )}
        {!loading && !counts && !configMissing && (
          <p className="text-white/70">
            No live slot aggregates have been published yet. Trigger a contribution or presence update to seed realtime data.
          </p>
        )}
      </div>
      <PresenceToggle supabase={supabase} counts={counts} itineraryId={itineraryId} />
    </CardGlass>
  );
}

const REALTIME_CHANNEL_KEY = "group-live-slots";

type PresenceToggleProps = {
  supabase: ComponentClient | null;
  counts: LiveSlotCounts | null;
  itineraryId: string;
};

type PresenceRowState = {
  id: string | null;
  optIn: boolean;
};

function PresenceToggle({ supabase, counts, itineraryId }: PresenceToggleProps) {
  const [presence, setPresence] = useState<PresenceRowState>({ id: null, optIn: false });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    if (!counts?.groupId) return;

    const client = supabase;
    let cancelled = false;

    async function loadPresence(client: ComponentClient, groupId: string) {
      const { data: auth } = await client.auth.getUser();
      const user = auth?.user ?? null;
      if (!user) {
        if (!cancelled) {
          setMessage("Sign in to manage your presence visibility.");
        }
        return;
      }

      setMessage(null);

      const { data, error } = await client
        .schema("concierge")
        .from("presence")
        .select("id,is_opted_in")
        .eq("group_id", groupId)
        .eq("traveler_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error && error.code !== "PGRST116") {
        console.error("concierge.presence.load", error);
        setMessage("Unable to load presence preferences.");
        return;
      }

      if (data) {
        setPresence({ id: data.id as string, optIn: Boolean(data.is_opted_in) });
      } else {
        setPresence({ id: null, optIn: false });
      }
    }

    const groupId = counts?.groupId;
    if (!groupId) return;
    loadPresence(client, groupId);

    return () => {
      cancelled = true;
    };
  }, [supabase, counts?.groupId]);

  const togglePresence = async () => {
    if (!supabase) return;
    const groupId = counts?.groupId;
    if (!groupId) return;

    setMessage(null);
    setPending(true);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user ?? null;
      if (!user) {
        setMessage("Sign in to control your presence visibility.");
        return;
      }

      const nextOptIn = !presence.optIn;
      const { error } = await supabase
        .schema("concierge")
        .from("presence")
        .upsert(
          {
            id: presence.id ?? undefined,
            traveler_id: user.id,
            group_id: groupId,
            itinerary_id: counts?.itineraryId ?? itineraryId,
            is_opted_in: nextOptIn,
            visible: nextOptIn,
            status: nextOptIn ? "online" : "offline",
            last_seen: new Date().toISOString(),
          },
          { onConflict: "traveler_id,group_id" },
        );

      if (error) {
        console.error("concierge.presence.upsert", error);
        setMessage("Unable to update presence preference.");
        return;
      }

      setPresence((state) => ({ id: state.id, optIn: nextOptIn }));
      setMessage(null);
      await supabase.functions.invoke("live-slots-update", {
        body: { itinerary_id: itineraryId },
      });
    } catch (error) {
      console.error("presence.toggle", error);
      setMessage("Unexpected error updating presence preference.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Presence sharing</p>
          <p className="text-white/80">Allow other travelers in this group to see when you are online.</p>
        </div>
        <button
          type="button"
          onClick={togglePresence}
          disabled={pending || !supabase || !counts?.groupId}
          className={classNames(
            "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-colors",
            presence.optIn
              ? "bg-sky-500 text-white shadow-lg shadow-sky-500/40 hover:bg-sky-400"
              : "bg-white/10 text-white hover:bg-white/20",
            pending && "opacity-60",
          )}
        >
          {pending ? "Saving…" : presence.optIn ? "Presence enabled" : "Share presence"}
        </button>
      </div>
      {message && <p className="text-xs text-rose-200/80">{message}</p>}
    </div>
  );
}
