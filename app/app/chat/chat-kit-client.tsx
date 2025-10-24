"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";

type ChatKitClientProps = {
  domainKey: string;
};

type SessionResponse = {
  clientSecret: string;
  expiresAt: number;
  sessionId: string;
  userId: string;
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

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      "x-chatkit-domain-key": domainKey,
    }),
    [domainKey],
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
  });

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
        <div style={{ marginTop: 16, border: "1px solid var(--border)", borderRadius: "var(--r-2xl)", overflow: "hidden" }}>
          <ChatKit ref={ref} control={control} style={{ width: "100%", minHeight: "520px" }} />
        </div>
      </div>
    </div>
  );
}
