import { ConciergeDailyBrief } from "@ecotrips/types";

interface GroupSavingsChatProps {
  briefs: ConciergeDailyBrief[];
  timezone?: string;
}

interface ChatMessage {
  id: string;
  author: "concierge" | "traveler";
  role: string;
  body: string;
  timestampLabel: string;
  badge?: string;
  meta?: string;
  highlight?: boolean;
}

export function GroupSavingsChat({ briefs, timezone }: GroupSavingsChatProps) {
  const messages = buildMessages(briefs, timezone);

  if (messages.length === 0) {
    return (
      <p className="text-sm text-white/70">
        Group savings nudges appear once ConciergeGuide assigns escrows to the itinerary.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/70">
        ConciergeGuide blends savings nudges with traveler replies so ops sees momentum before departure.
      </p>
      <ul className="space-y-4">
        {messages.map((message) => (
          <li key={message.id} className={`flex ${message.author === "traveler" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl border px-4 py-3 text-sm shadow-lg transition ${
                message.author === "concierge"
                  ? "border-sky-500/40 bg-sky-500/10 text-sky-50"
                  : "border-white/10 bg-white/10 text-white"
              } ${message.highlight ? "ring-2 ring-sky-400/60" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-white/60">
                <span>{message.role}</span>
                <span className="text-white/40">·</span>
                <span>{message.timestampLabel}</span>
                {message.badge && (
                  <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-200">
                    {message.badge}
                  </span>
                )}
              </div>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-sm">{message.body}</p>
              {message.meta && <p className="mt-3 text-xs text-white/50">{message.meta}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildMessages(briefs: ConciergeDailyBrief[], timezone?: string): ChatMessage[] {
  const now = new Date();
  const sorted = [...briefs]
    .filter((brief) => brief.group_savings)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const messages: ChatMessage[] = [];

  for (const brief of sorted) {
    const savings = brief.group_savings;
    if (!savings) continue;
    const progress = computeProgress(savings.collected_cents, savings.target_cents);
    const due = parseDate(savings.due_date) ?? parseDate(brief.date) ?? now;
    const hoursRemaining = (due.getTime() - now.getTime()) / (60 * 60 * 1000);
    const badge = hoursRemaining <= 48 ? `Due in ${formatDuration(hoursRemaining)}` : undefined;
    const timestampLabel = formatDateTime(due, timezone);

    messages.push({
      id: `concierge-${brief.day}`,
      author: "concierge",
      role: "ConciergeGuide",
      body: `${savings.nudge_copy}\n${progress}% funded · goal ${formatCurrency(savings.target_cents)}`,
      timestampLabel,
      badge,
      highlight: progress < 100,
      meta: `Day ${brief.day} · escrow ${savings.escrow_id}`,
    });

    messages.push({
      id: `traveler-${brief.day}`,
      author: "traveler",
      role: "Group lead",
      body:
        progress < 100
          ? `On it — posting reminder now and tagging the last two contributors. I'll confirm once we cross ${formatCurrency(
              savings.target_cents,
            )}.`
          : "Escrow topped up. Sharing payout plan in tomorrow's brief.",
      timestampLabel: `Logged ${formatDateTime(now, timezone)}`,
      meta: progress < 100 ? "Reminder staged in WhatsApp" : "Savings goal completed",
    });
  }

  return messages.slice(0, 6);
}

function computeProgress(collected: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((collected / target) * 100));
}

function formatDateTime(date: Date, timezone?: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone ?? "UTC",
    }).format(date);
  } catch (_error) {
    return date.toISOString();
  }
}

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return "RWF 0";
  return `RWF ${Math.round(value).toLocaleString("en-US")}`;
}

function parseDate(raw: string | undefined) {
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function formatDuration(hoursRemaining: number) {
  if (!Number.isFinite(hoursRemaining)) return "soon";
  if (hoursRemaining <= 1) {
    return "1 hr";
  }
  if (hoursRemaining < 24) {
    return `${Math.max(2, Math.round(hoursRemaining))} hrs`;
  }
  return `${Math.max(1, Math.round(hoursRemaining / 24))} days`;
}
