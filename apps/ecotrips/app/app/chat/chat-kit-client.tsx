"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import type { Widgets } from "@openai/chatkit";

type ChatKitClientProps = {
  domainKey: string;
};

type SessionResponse = {
  clientSecret: string;
  expiresAt: number;
  sessionId: string;
  userId: string;
};

type PlannerPreferences = {
  destination: string;
  travelMonth: string;
  nights: number;
  travelers: number;
  carbonFocus: string;
  mobilitySupport: string;
  interests: string[];
  notes?: string;
};

type PlannerSummary = {
  summary: string;
  composerPrompt: string;
  highlights: string[];
  sustainabilityTips: string[];
};

type ActionStatus = {
  type: string | null;
  state: "idle" | "loading" | "success" | "error";
  message?: string;
};

const STORAGE_KEY = "ecotrips.chatkit.user";

function readStoredUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Unable to access localStorage", error);
    return null;
  }
}

function writeStoredUserId(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, userId);
  } catch (error) {
    console.warn("Unable to persist userId", error);
  }
}

export function ChatKitClient({ domainKey }: ChatKitClientProps) {
  const userIdRef = useRef<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("Idle");
  const [error, setError] = useState<string | null>(null);
  const actionHandlerRef = useRef<
    ((
      action: { type: string; payload?: Record<string, unknown> },
      widgetItem: { id: string; widget: Widgets.Card | Widgets.ListView },
    ) => Promise<void>)
    | null
  >(null);
  const [actionStatus, setActionStatus] = useState<ActionStatus>({ type: null, state: "idle" });
  const [plannerSummary, setPlannerSummary] = useState<PlannerSummary | null>(null);
  const [plannerForm, setPlannerForm] = useState<PlannerPreferences>({
    destination: "Costa Rica",
    travelMonth: new Date().toISOString().slice(0, 7),
    nights: 6,
    travelers: 2,
    carbonFocus: "low-emission",
    mobilitySupport: "None",
    interests: ["rainforest", "community"] as string[],
    notes: "Include at least one volunteer conservation activity.",
  });

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      "x-chatkit-domain-key": domainKey,
    }),
    [domainKey],
  );

  const quickPrompts = useMemo(
    () => [
      {
        id: "low-carbon-weekend",
        title: "Low-carbon weekend escape",
        prompt:
          "Suggest a 3-day weekend escape by rail from a major US city with eco-lodges, plant-forward dining, and optional volunteer time.",
      },
      {
        id: "family-adventure",
        title: "Family adventure",
        prompt:
          "Create a kid-friendly itinerary focused on wildlife rehabilitation programs and hands-on ecology workshops.",
      },
      {
        id: "remote-work",
        title: "Remote work retreat",
        prompt:
          "Design a 10-day remote work retreat with fiber internet, local carbon offsets, and guided mindfulness hikes.",
      },
      {
        id: "culinary-trail",
        title: "Culinary trail",
        prompt:
          "Plan a culinary tour spotlighting regenerative farms, zero-waste restaurants, and community cooking classes.",
      },
    ],
    [],
  );

  const widgetActionProxy = useCallback(
    async (
      action: { type: string; payload?: Record<string, unknown> },
      widgetItem: { id: string; widget: Widgets.Card | Widgets.ListView },
    ) => {
      if (!actionHandlerRef.current) {
        return;
      }

      await actionHandlerRef.current(action, widgetItem);
    },
    [],
  );

  const getClientSecret = useCallback(
    async (currentClientSecret: string | null) => {
      setError(null);

      if (!userIdRef.current) {
        userIdRef.current = readStoredUserId();
      }

      const shouldRefresh = Boolean(currentClientSecret && userIdRef.current);
      setStatus(shouldRefresh ? "Refreshing session" : "Starting session");

      const endpoint = shouldRefresh ? "/api/chatkit/refresh" : "/api/chatkit/start";
      const payload = shouldRefresh
        ? { userId: userIdRef.current }
        : { userId: userIdRef.current ?? undefined };

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      if (!response.ok) {
        const raw = await response.text();
        let message = raw.trim();
        if (!message) {
          message = `Request to ${endpoint} failed with status ${response.status}`;
        }
        try {
          const parsed = JSON.parse(raw) as { error?: string };
          if (parsed?.error) {
            message = parsed.error;
          }
        } catch (error) {
          // Ignore JSON parse issues and fall back to the raw message.
        }
        setError(message || "Unexpected error while obtaining session");
        throw new Error(message || "Failed to issue client secret");
      }

      const data = (await response.json()) as SessionResponse;
      userIdRef.current = data.userId;
      writeStoredUserId(data.userId);
      setSessionId(data.sessionId);
      setExpiresAt(data.expiresAt);
      setStatus("Connected");
      setError(null);
      return data.clientSecret;
    },
    [headers],
  );

  const { control, ref } = useChatKit({
    api: { getClientSecret },
    theme: {
      colorScheme: "dark",
      density: "normal",
      radius: "round",
      color: {
        surface: { background: "#121212", foreground: "#ECECEC" },
        accent: { primary: "#10B981", level: 2 },
      },
    },
    header: {
      enabled: true,
      title: { text: "EcoTrips Atlas Concierge" },
    },
    history: { enabled: true, showDelete: true, showRename: true },
    composer: {
      placeholder: "Plan my sustainable adventure...",
    },
    disclaimer: {
      text: "Responses are AI-generated. Verify details before booking.",
      highContrast: true,
    },
    startScreen: {
      greeting: "Where should we plan your next low-carbon journey?",
      prompts: quickPrompts.map((item) => ({
        id: item.id,
        title: item.title,
        prompt: item.prompt,
      })),
    },
    widgets: {
      onAction: widgetActionProxy,
    },
  });

  const formatMonth = useCallback((value: string) => {
    if (!value) return "";
    const [year, month] = value.split("-").map(Number);
    if (!year || !month) return value;
    const date = new Date(Date.UTC(year, month - 1, 1));
    return date.toLocaleString(undefined, { month: "long", year: "numeric" });
  }, []);

  const parsePlannerPreferences = useCallback(
    (payload: Record<string, unknown>): PlannerPreferences => {
      const destination = typeof payload.destination === "string" ? payload.destination.trim() : "";
      const travelMonth = typeof payload.travelMonth === "string" ? payload.travelMonth : "";
      const nightsRaw = Number.parseInt(String(payload.nights ?? payload.tripLength ?? plannerForm.nights), 10);
      const travelersRaw = Number.parseInt(String(payload.travelers ?? payload.partySize ?? plannerForm.travelers), 10);
      const carbonFocus = typeof payload.carbonFocus === "string" ? payload.carbonFocus : plannerForm.carbonFocus;
      const mobilitySupport =
        typeof payload.mobilitySupport === "string" ? payload.mobilitySupport : plannerForm.mobilitySupport;
      const interestsSource = Array.isArray(payload.interests)
        ? payload.interests
        : typeof payload.interests === "string"
          ? payload.interests.split(",")
          : plannerForm.interests;
      const interests = interestsSource
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0);
      const notes = typeof payload.notes === "string" ? payload.notes : plannerForm.notes;

      return {
        destination,
        travelMonth,
        nights: Number.isFinite(nightsRaw) && nightsRaw > 0 ? nightsRaw : plannerForm.nights,
        travelers: Number.isFinite(travelersRaw) && travelersRaw > 0 ? travelersRaw : plannerForm.travelers,
        carbonFocus,
        mobilitySupport,
        interests: interests.length > 0 ? interests : plannerForm.interests,
        notes,
      };
    },
    [plannerForm],
  );

  const syncPlannerState = useCallback(
    (preferences: PlannerPreferences) => {
      setPlannerForm(preferences);
    },
    [],
  );

  const processPlannerPreferences = useCallback(
    async (preferences: PlannerPreferences) => {
      setActionStatus({ type: "submit_trip_preferences", state: "loading" });

      try {
        const response = await fetch("/api/chatkit/preferences", {
          method: "POST",
          headers,
          body: JSON.stringify(preferences),
        });

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || "Planner service returned an error");
        }

        const data = (await response.json()) as PlannerSummary & { ok?: boolean; message?: string };

        setPlannerSummary(data);
        setActionStatus({
          type: "submit_trip_preferences",
          state: "success",
          message: data.summary || data.message || "Itinerary brief ready to review in the composer",
        });

        if (ref.current) {
          await ref.current.setComposerValue({ text: data.composerPrompt });
          await ref.current.focusComposer();
        }
      } catch (plannerError) {
        console.error("Unable to process planner preferences", plannerError);
        const message =
          plannerError instanceof Error ? plannerError.message : "Unable to process trip preferences right now.";
        setActionStatus({ type: "submit_trip_preferences", state: "error", message });
      }
    },
    [headers, ref],
  );

  const handleWidgetAction = useCallback(
    async (
      action: { type: string; payload?: Record<string, unknown> },
      widgetItem: { id: string; widget: Widgets.Card | Widgets.ListView },
    ) => {
      if (action.type === "prefill_prompt") {
        const prompt = typeof action.payload?.prompt === "string" ? action.payload.prompt : "";
        if (!prompt || !ref.current) {
          return;
        }

        await ref.current.setComposerValue({ text: prompt });
        await ref.current.focusComposer();
        setActionStatus({ type: "prefill_prompt", state: "success", message: "Prompt loaded into the composer." });
        return;
      }

      if (action.type === "send_prompt") {
        const prompt = typeof action.payload?.prompt === "string" ? action.payload.prompt : "";
        if (!prompt || !ref.current) {
          return;
        }

        await ref.current.sendUserMessage({ text: prompt, newThread: action.payload?.newThread === true });
        setActionStatus({ type: "send_prompt", state: "success", message: "Sent recommended concierge prompt." });
        return;
      }

      if (action.type === "submit_trip_preferences") {
        const preferences = parsePlannerPreferences(action.payload ?? {});
        syncPlannerState(preferences);
        await processPlannerPreferences(preferences);
        return;
      }

      console.info("Unhandled widget action", action, widgetItem.id);
    },
    [parsePlannerPreferences, processPlannerPreferences, ref, syncPlannerState],
  );

  const handleQuickPrompt = useCallback(
    async (prompt: string) => {
      if (!prompt || !ref.current) {
        return;
      }

      try {
        await ref.current.setComposerValue({ text: prompt });
        await ref.current.focusComposer();
        setActionStatus({ type: "quick_prompt", state: "success", message: "Prompt staged in the composer." });
      } catch (composerError) {
        console.error("Unable to stage quick prompt", composerError);
        setActionStatus({ type: "quick_prompt", state: "error", message: "Unable to prepare the prompt." });
      }
    },
    [ref],
  );

  const handlePlannerFieldChange = useCallback(<K extends keyof PlannerPreferences>(key: K, value: PlannerPreferences[K]) => {
    setPlannerForm((current) => ({ ...current, [key]: value }));
  }, []);

  const toggleInterest = useCallback((interest: string) => {
    setPlannerForm((current) => {
      const exists = current.interests.includes(interest);
      const interests = exists
        ? current.interests.filter((item) => item !== interest)
        : [...current.interests, interest];
      return { ...current, interests };
    });
  }, []);

  const handlePlannerSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await processPlannerPreferences(plannerForm);
    },
    [plannerForm, processPlannerPreferences],
  );

  useEffect(() => {
    actionHandlerRef.current = handleWidgetAction;
    return () => {
      actionHandlerRef.current = null;
    };
  }, [handleWidgetAction]);

  return (
    <div className="container" style={{ maxWidth: 880 }}>
      <div className="card" style={{ padding: 24, minHeight: "70vh" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="h1">EcoTrips Atlas Concierge</div>
            <p className="subtle">Chat with our AI travel guide for climate-friendly itineraries.</p>
          </div>
          <div className="badge">
            <span>{status}</span>
            {expiresAt ? (
              <span>expires {new Date(expiresAt * 1000).toLocaleTimeString()}</span>
            ) : null}
          </div>
        </div>
        {sessionId ? (
          <p className="subtle" style={{ marginTop: -8 }}>
            Session <code>{sessionId}</code>
          </p>
        ) : null}
        {error ? (
          <div className="toast error" role="alert">
            {error}
          </div>
        ) : null}
        {actionStatus.state === "error" && actionStatus.message ? (
          <div className="toast error" role="alert" style={{ marginTop: 12 }}>
            {actionStatus.message}
          </div>
        ) : null}
        {actionStatus.state === "success" && actionStatus.message ? (
          <div className="toast" role="status" style={{ marginTop: 12 }}>
            {actionStatus.message}
          </div>
        ) : null}
        <div
          className="card"
          style={{
            marginTop: 16,
            border: "1px solid var(--border)",
            borderRadius: "var(--r-xl)",
            background: "rgba(16, 185, 129, 0.06)",
            padding: 16,
          }}
        >
          <div className="row" style={{ alignItems: "center", marginBottom: 12, gap: 12 }}>
            <div>
              <div className="h3" style={{ margin: 0 }}>Concierge launch actions</div>
              <p className="subtle" style={{ margin: 0 }}>
                Prefill the composer or generate a planning brief before looping in the router agent.
              </p>
            </div>
            <div className="badge" style={{ marginLeft: "auto" }}>
              <span>Start screen shortcuts sync automatically with ChatKit widgets</span>
            </div>
          </div>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            {quickPrompts.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleQuickPrompt(item.prompt)}
                style={{
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  borderRadius: "9999px",
                  padding: "6px 16px",
                  background: "transparent",
                  color: "#10B981",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {item.title}
              </button>
            ))}
          </div>
          <form onSubmit={handlePlannerSubmit} style={{ marginTop: 20, display: "grid", gap: 12 }}>
            <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
              <label style={{ flex: "1 1 220px" }}>
                <span className="subtle" style={{ display: "block", marginBottom: 4 }}>
                  Destination focus
                </span>
                <input
                  type="text"
                  value={plannerForm.destination}
                  onChange={(event) => handlePlannerFieldChange("destination", event.target.value)}
                  placeholder="Country, region, or biosphere"
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "var(--r-lg)",
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.04)",
                    color: "inherit",
                  }}
                />
              </label>
              <label style={{ flex: "1 1 160px" }}>
                <span className="subtle" style={{ display: "block", marginBottom: 4 }}>
                  Target month
                </span>
                <input
                  type="month"
                  value={plannerForm.travelMonth}
                  onChange={(event) => handlePlannerFieldChange("travelMonth", event.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "var(--r-lg)",
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.04)",
                    color: "inherit",
                  }}
                />
              </label>
              <label style={{ flex: "1 1 120px" }}>
                <span className="subtle" style={{ display: "block", marginBottom: 4 }}>
                  Nights
                </span>
                <input
                  type="number"
                  min={1}
                  value={plannerForm.nights}
                  onChange={(event) => handlePlannerFieldChange("nights", Number.parseInt(event.target.value, 10) || 1)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "var(--r-lg)",
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.04)",
                    color: "inherit",
                  }}
                />
              </label>
              <label style={{ flex: "1 1 120px" }}>
                <span className="subtle" style={{ display: "block", marginBottom: 4 }}>
                  Travelers
                </span>
                <input
                  type="number"
                  min={1}
                  value={plannerForm.travelers}
                  onChange={(event) =>
                    handlePlannerFieldChange("travelers", Number.parseInt(event.target.value, 10) || 1)
                  }
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "var(--r-lg)",
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.04)",
                    color: "inherit",
                  }}
                />
              </label>
            </div>
            <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
              <label style={{ flex: "1 1 220px" }}>
                <span className="subtle" style={{ display: "block", marginBottom: 4 }}>
                  Carbon focus
                </span>
                <select
                  value={plannerForm.carbonFocus}
                  onChange={(event) => handlePlannerFieldChange("carbonFocus", event.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "var(--r-lg)",
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.04)",
                    color: "inherit",
                  }}
                >
                  <option value="low-emission">Low emission (rail & renewables)</option>
                  <option value="balanced">Balanced (mix of eco-certified flights and offsets)</option>
                  <option value="off-grid">Off-grid regenerative retreat</option>
                </select>
              </label>
              <label style={{ flex: "1 1 220px" }}>
                <span className="subtle" style={{ display: "block", marginBottom: 4 }}>
                  Mobility support
                </span>
                <select
                  value={plannerForm.mobilitySupport}
                  onChange={(event) => handlePlannerFieldChange("mobilitySupport", event.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "var(--r-lg)",
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.04)",
                    color: "inherit",
                  }}
                >
                  <option value="None">None</option>
                  <option value="Limited mobility">Limited mobility (step-free, accessible transport)</option>
                  <option value="Wheelchair">Wheelchair accessible routes required</option>
                </select>
              </label>
            </div>
            <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
              <legend className="subtle" style={{ marginBottom: 6 }}>
                Spotlight interests
              </legend>
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                {[
                  { id: "rainforest", label: "Rainforest restoration" },
                  { id: "marine", label: "Marine sanctuaries" },
                  { id: "cycling", label: "Cycling & e-mobility" },
                  { id: "wellness", label: "Wellness & mindfulness" },
                  { id: "community", label: "Community-led tourism" },
                ].map((interest) => {
                  const checked = plannerForm.interests.includes(interest.id);
                  return (
                    <label
                      key={interest.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        borderRadius: "9999px",
                        border: checked ? "1px solid #10B981" : "1px solid var(--border)",
                        background: checked ? "rgba(16, 185, 129, 0.15)" : "rgba(255,255,255,0.02)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleInterest(interest.id)}
                        style={{ cursor: "pointer" }}
                      />
                      <span>{interest.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <label>
              <span className="subtle" style={{ display: "block", marginBottom: 4 }}>
                Notes for the concierge
              </span>
              <textarea
                value={plannerForm.notes ?? ""}
                onChange={(event) => handlePlannerFieldChange("notes", event.target.value)}
                rows={3}
                placeholder="Budget guardrails, certifications to honor, or travelers to prioritize"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "var(--r-lg)",
                  border: "1px solid var(--border)",
                  background: "rgba(255,255,255,0.04)",
                  color: "inherit",
                  resize: "vertical",
                }}
              />
            </label>
            <div className="row" style={{ justifyContent: "flex-end", gap: 12 }}>
              <button
                type="submit"
                style={{
                  padding: "10px 20px",
                  borderRadius: "9999px",
                  border: "none",
                  background: "#10B981",
                  color: "#041407",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Generate itinerary brief
              </button>
            </div>
          </form>
          {plannerSummary ? (
            <div
              style={{
                marginTop: 20,
                borderTop: "1px solid rgba(16,185,129,0.25)",
                paddingTop: 16,
                display: "grid",
                gap: 12,
              }}
            >
              <div>
                <div className="h4" style={{ margin: 0 }}>Ready-to-send concierge brief</div>
                <p className="subtle" style={{ margin: 0 }}>{plannerSummary.summary}</p>
              </div>
              <div>
                <strong>Highlights to emphasize</strong>
                <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                  {plannerSummary.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>Sustainability guardrails</strong>
                <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                  {plannerSummary.sustainabilityTips.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="badge">
                <span>Composer updated with concierge-ready instructions</span>
                <span>{formatMonth(plannerForm.travelMonth)}</span>
              </div>
            </div>
          ) : null}
        </div>
        <div style={{ marginTop: 16, border: "1px solid var(--border)", borderRadius: "var(--r-2xl)", overflow: "hidden" }}>
          <ChatKit ref={ref} control={control} style={{ width: "100%", minHeight: "520px" }} />
        </div>
      </div>
    </div>
  );
}
