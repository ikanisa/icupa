"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Button, Toast } from "@ecotrips/ui";
import { createEcoTripsFunctionClient } from "@ecotrips/api";
import { TravelAirPriceWatchInput } from "@ecotrips/types";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

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

const COMMAND_PREFIX = "/watch price";

export function SupportChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createAssistantMessage(
      "Hi! Use /watch price origin=KGL destination=NBO depart=2024-08-14 max=325 contact=you@example.com to track fares.",
    ),
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<{ id: string; title: string; description?: string } | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    setMessages((prev) => [...prev, createUserMessage(trimmed)]);
    setInput("");

    if (!trimmed.toLowerCase().startsWith(COMMAND_PREFIX)) {
      setMessages((prev) => [
        ...prev,
        createAssistantMessage(
          "Unknown command. Try /watch price origin=KGL destination=NBO depart=2024-08-14 max=325",
        ),
      ]);
      return;
    }

    const parsed = parseWatchCommand(trimmed);
    if (!parsed.ok) {
      setMessages((prev) => [...prev, createAssistantMessage(parsed.error)]);
      return;
    }

    const client = await clientPromise;
    if (!client) {
      setMessages((prev) => [
        ...prev,
        createAssistantMessage(
          "Supabase credentials missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable live requests.",
        ),
      ]);
      return;
    }

    setPending(true);
    try {
      const response = await client.call("travel.air.priceWatch", parsed.input);
      setMessages((prev) => [
        ...prev,
        createAssistantMessage(
          `Price watch ${response.watch_id} active for ${parsed.summary}. We'll ping when fares drop below ${formatCurrency(
            parsed.input.currency,
            parsed.targetPriceCents,
          )}.`,
        ),
      ]);
    } catch (error) {
      console.error("air.priceWatch", error);
      const description =
        error instanceof Error ? error.message : "Unable to create price watch. Please retry shortly.";
      setToast({ id: "price-watch-error", title: "Price watch failed", description });
      setMessages((prev) => [
        ...prev,
        createAssistantMessage("Price watch failed to save. We'll keep listening and you can retry."),
      ]);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={listRef}
        className="max-h-80 overflow-y-auto rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/90 shadow-inner"
      >
        <ul className="space-y-4">
          {messages.map((message) => (
            <li key={message.id} className="space-y-1">
              <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                {message.role === "assistant" ? "Concierge" : "You"} · {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div
                className={
                  message.role === "assistant"
                    ? "rounded-2xl bg-white/10 px-4 py-3 backdrop-blur"
                    : "rounded-2xl bg-sky-500/20 px-4 py-3 text-sky-100"
                }
              >
                {message.content}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-sm">
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.2em] text-white/60">Command</span>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="/watch price origin=KGL destination=NBO depart=2024-08-14 max=325"
            className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-base text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400"
            disabled={pending}
            autoComplete="off"
          />
        </label>
        <Button type="submit" variant="glass" className="self-end" disabled={pending}>
          {pending ? "Scheduling…" : "Send"}
        </Button>
      </form>
      <div className="fixed bottom-24 left-1/2 z-40 w-full max-w-sm -translate-x-1/2">
        {toast && <Toast id={toast.id} title={toast.title} description={toast.description} onDismiss={() => setToast(null)} />}
      </div>
    </div>
  );
}

function parseWatchCommand(input: string): {
  ok: true;
  input: TravelAirPriceWatchInput;
  summary: string;
  targetPriceCents: number;
} | { ok: false; error: string; targetPriceCents?: number } {
  const raw = input.slice(COMMAND_PREFIX.length).trim();
  if (!raw) {
    return { ok: false, error: "Usage: /watch price origin=KGL destination=NBO depart=2024-08-14 max=325" };
  }

  const params: Record<string, string> = {};
  for (const token of raw.split(/\s+/)) {
    const [key, ...valueParts] = token.split("=");
    if (!key || valueParts.length === 0) continue;
    params[key.toLowerCase()] = valueParts.join("=");
  }

  const currency = (params.currency ?? "USD").toUpperCase();
  const targetPrice = parseFloat(params.max ?? params.max_price ?? params.price ?? "");
  const targetPriceCents = Number.isFinite(targetPrice) && targetPrice > 0 ? Math.round(targetPrice * 100) : undefined;
  const targetCents = parseInt(params.max_cents ?? params.target_price_cents ?? "", 10);

  const payloadCandidate = {
    origin: params.origin ?? params.from ?? "",
    destination: params.destination ?? params.to ?? "",
    departureDate: params.depart ?? params.departure ?? params.departuredate ?? "",
    returnDate: params.return ?? params.ret ?? undefined,
    currency,
    targetPriceCents: Number.isInteger(targetCents) && targetCents > 0 ? targetCents : targetPriceCents,
    targetPrice: Number.isFinite(targetPrice) && targetPrice > 0 ? targetPrice : undefined,
    contact: params.contact ?? params.email ?? undefined,
    channel: "chat",
    notes: params.notes,
  } satisfies Partial<TravelAirPriceWatchInput>;

  const parsed = TravelAirPriceWatchInput.safeParse(payloadCandidate);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Unable to parse command.";
    return { ok: false, error: message };
  }

  const summary = `${parsed.data.origin} → ${parsed.data.destination} on ${parsed.data.departureDate}`;
  const cents = parsed.data.targetPriceCents ?? Math.round((parsed.data.targetPrice ?? 0) * 100);

  if (!Number.isInteger(cents) || cents <= 0) {
    return { ok: false, error: "Provide max=<amount> or max_cents=<amount> greater than zero." };
  }

  return {
    ok: true,
    input: { ...parsed.data, targetPriceCents: cents },
    summary,
    targetPriceCents: cents,
  };
}

function formatCurrency(currency: string, cents: number): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch (_error) {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

function createAssistantMessage(content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    timestamp: new Date(),
  };
}

function createUserMessage(content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    content,
    timestamp: new Date(),
  };
}
