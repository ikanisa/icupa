"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { Button, Toast } from "@ecotrips/ui";
import { createEcoTripsFunctionClient } from "@ecotrips/api";
import {
  AUTONOMY_CATEGORY_VALUES,
  AUTONOMY_LEVEL_VALUES,
  COMPOSER_DIAL_VALUES,
  AutonomyPreference,
  AutonomyPreferencesResponse,
} from "@ecotrips/types";

const clientPromise = (async () => {
  if (typeof window === "undefined") return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;
  return createEcoTripsFunctionClient({
    supabaseUrl,
    anonKey,
    getAccessToken: async () => null,
  });
})();

type AutonomyCategory = AutonomyPreference["category"];
type AutonomyLevel = AutonomyPreference["level"];
type ComposerDial = AutonomyPreference["composer"];

type PreferenceState = Record<
  AutonomyCategory,
  { level: AutonomyLevel; composer: ComposerDial }
>;

type ToastState = { id: string; title: string; description?: string } | null;

const DEFAULT_LEVEL: AutonomyLevel = "L1";
const DEFAULT_COMPOSER: ComposerDial = "assist";

const CATEGORY_METADATA: Record<AutonomyCategory, { label: string; description: string }> = {
  planner: {
    label: "Planner",
    description: "Quotes, holds, and checkout orchestration.",
  },
  concierge: {
    label: "Concierge",
    description: "In-trip reroutes, nearby lookups, and dailies.",
  },
  support: {
    label: "Support",
    description: "Post-booking triage, refunds, and escalations.",
  },
  ops: {
    label: "Ops",
    description: "Supplier follow-ups, payouts, and ledger actions.",
  },
  marketing: {
    label: "Marketing",
    description: "Content and campaign automation for storytelling.",
  },
};

const LEVEL_LABELS: Record<AutonomyLevel, { title: string; badge: string }> = {
  L0: { title: "Manual", badge: "L0" },
  L1: { title: "Suggest", badge: "L1" },
  L2: { title: "Execute L2", badge: "L2" },
  L3: { title: "Execute L3", badge: "L3" },
  L4: { title: "Trusted", badge: "L4" },
  L5: { title: "Delegate", badge: "L5" },
};

const COMPOSER_LABELS: Record<ComposerDial, string> = {
  observe: "Observe",
  assist: "Assist",
  co_create: "Co-create",
  delegate: "Delegate",
};

function buildDefaultState(): PreferenceState {
  const next = {} as PreferenceState;
  for (const category of AUTONOMY_CATEGORY_VALUES) {
    next[category as AutonomyCategory] = {
      level: DEFAULT_LEVEL,
      composer: DEFAULT_COMPOSER,
    };
  }
  return next;
}

function deriveStateFromResponse(response: AutonomyPreferencesResponse): PreferenceState {
  const base = buildDefaultState();
  for (const pref of response.preferences) {
    if (!pref || typeof pref.category !== "string") continue;
    if ((AUTONOMY_CATEGORY_VALUES as readonly string[]).includes(pref.category)) {
      base[pref.category as AutonomyCategory] = {
        level: pref.level,
        composer: pref.composer,
      };
    }
  }
  return base;
}

function cloneState(source: PreferenceState): PreferenceState {
  const next = {} as PreferenceState;
  for (const category of AUTONOMY_CATEGORY_VALUES) {
    const key = category as AutonomyCategory;
    next[key] = { ...source[key] };
  }
  return next;
}

export function AutonomySettingsSheet() {
  const [state, setState] = useState<PreferenceState>(buildDefaultState);
  const [initialState, setInitialState] = useState<PreferenceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    const load = async () => {
      const client = await clientPromise;
      if (!client) {
        setError("Supabase client unavailable. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
        setLoading(false);
        return;
      }

      try {
        const response = await client.call("user.autonomy.get", {} as never);
        const parsed = response as AutonomyPreferencesResponse;
        const nextState = deriveStateFromResponse(parsed);
        setState(nextState);
        setInitialState(cloneState(nextState));
        setSource(parsed.source ?? null);
      } catch (err) {
        console.error("user.autonomy.get", err);
        setError("Unable to load autonomy preferences. Try again later.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const hasChanges = useMemo(() => {
    if (!initialState) return false;
    return AUTONOMY_CATEGORY_VALUES.some((category) => {
      const current = state[category as AutonomyCategory];
      const initial = initialState[category as AutonomyCategory];
      return current.level !== initial.level || current.composer !== initial.composer;
    });
  }, [state, initialState]);

  const handleLevelChange = (category: AutonomyCategory, level: AutonomyLevel) => {
    setState((prev) => ({
      ...prev,
      [category]: { ...prev[category], level },
    }));
  };

  const handleComposerChange = (category: AutonomyCategory, composer: ComposerDial) => {
    setState((prev) => ({
      ...prev,
      [category]: { ...prev[category], composer },
    }));
  };

  const handleSave = async () => {
    const client = await clientPromise;
    if (!client) {
      setToast({ id: "offline", title: "Not ready", description: "Supabase client missing." });
      return;
    }

    setPending(true);
    try {
      const payload = {
        preferences: AUTONOMY_CATEGORY_VALUES.map((category) => ({
          category: category as AutonomyCategory,
          level: state[category as AutonomyCategory].level,
          composer: state[category as AutonomyCategory].composer,
        })),
      };
      const response = await client.call("user.autonomy.save", payload as never);
      const parsed = response as AutonomyPreferencesResponse;
      const next = deriveStateFromResponse(parsed);
      setState(next);
      setInitialState(cloneState(next));
      setSource(parsed.source ?? null);
      setToast({
        id: "saved",
        title: "Preferences saved",
        description: parsed.source === "fixtures"
          ? "Fixtures updated locally."
          : "Autonomy preferences persisted.",
      });
    } catch (err) {
      console.error("user.autonomy.save", err);
      setToast({ id: "error", title: "Save failed", description: "Unable to persist autonomy preferences." });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <p className="text-sm text-white/60">Loading autonomy preferences…</p>
      ) : error ? (
        <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
      ) : null}

      <div className="space-y-4">
        {AUTONOMY_CATEGORY_VALUES.map((categoryKey) => {
          const category = categoryKey as AutonomyCategory;
          const meta = CATEGORY_METADATA[category];
          const value = state[category];
          return (
            <section
              key={category}
              className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.45)]"
            >
              <header className="flex flex-col gap-1">
                <h3 className="text-base font-semibold text-white">{meta.label}</h3>
                <p className="text-sm text-white/70">{meta.description}</p>
              </header>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/50">Autonomy level</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {AUTONOMY_LEVEL_VALUES.map((levelKey) => {
                      const level = levelKey as AutonomyLevel;
                      const active = value.level === level;
                      const details = LEVEL_LABELS[level];
                      return (
                        <button
                          key={`${category}-level-${level}`}
                          type="button"
                          onClick={() => handleLevelChange(category, level)}
                          className={clsx(
                            "flex flex-col gap-1 rounded-2xl border px-3 py-2 text-left text-xs transition",
                            active
                              ? "border-sky-400/70 bg-sky-500/20 text-sky-100 shadow-inner shadow-sky-500/30"
                              : "border-white/10 bg-slate-900/40 text-white/70 hover:border-sky-400/40 hover:text-white",
                          )}
                        >
                          <span className="text-sm font-medium">{details.title}</span>
                          <span className="text-[10px] uppercase tracking-wide text-white/50">{details.badge}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/50">Composer dial</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {COMPOSER_DIAL_VALUES.map((composerKey) => {
                      const composer = composerKey as ComposerDial;
                      const active = value.composer === composer;
                      return (
                        <button
                          key={`${category}-composer-${composer}`}
                          type="button"
                          onClick={() => handleComposerChange(category, composer)}
                          className={clsx(
                            "rounded-2xl border px-3 py-2 text-xs font-medium transition",
                            active
                              ? "border-emerald-400/70 bg-emerald-400/20 text-emerald-100 shadow-inner shadow-emerald-400/40"
                              : "border-white/10 bg-slate-900/40 text-white/70 hover:border-emerald-400/40 hover:text-white",
                          )}
                        >
                          {COMPOSER_LABELS[composer]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-white/60">
          Source: {source ? source : "default"}
        </p>
        <Button onClick={handleSave} disabled={pending || !initialState || !hasChanges}>
          {pending ? "Saving…" : hasChanges ? "Save changes" : "Saved"}
        </Button>
      </div>

      <div className="fixed bottom-24 left-1/2 z-50 w-full max-w-sm -translate-x-1/2">
        {toast && <Toast id={toast.id} title={toast.title} description={toast.description} onDismiss={() => setToast(null)} />}
      </div>
    </div>
  );
}
