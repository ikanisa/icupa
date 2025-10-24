"use client";

import { useFormState, useFormStatus } from "react-dom";
import { buttonClassName, Toast } from "@ecotrips/ui";
import type { AdminActionState } from "@ecotrips/ui";

export type ThreadEntry = {
  id: string;
  type: "message" | "note" | "call" | "call_summary";
  author: string;
  channel: string;
  sent_at: string;
  body: string;
  highlights?: string[];
  next_steps?: string[];
  sentiment?: string;
  call_id?: string;
  dialer_url?: string;
  expires_at?: string;
};

export type ContactThreadState = AdminActionState & {
  entries: ThreadEntry[];
  call?: {
    callId: string;
    status: string;
    dialerUrl?: string;
    expiresAt?: string;
    participantName?: string;
    participantPhone?: string;
  };
  requestId?: string;
};

const initialStatusToastId = "contact-thread-toast";

type ContactThreadPanelProps = {
  action: (state: ContactThreadState, formData: FormData) => Promise<ContactThreadState>;
  initialState: ContactThreadState;
  travelerName: string;
  travelerPhone: string;
  subject: string;
};

export function ContactThreadPanel({ action, initialState, travelerName, travelerPhone, subject }: ContactThreadPanelProps) {
  const [state, formAction] = useFormState(action, initialState);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-300/80">Contact thread</p>
        <h2 className="text-xl font-semibold text-white">{subject}</h2>
        <p className="text-sm text-white/70">
          {travelerName} · {travelerPhone}
        </p>
      </header>
      <div className="space-y-3">
        {state.entries.map((entry) => (
          <ThreadEntryRow key={entry.id} entry={entry} />
        ))}
      </div>
      {state.call && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          <p className="font-semibold">Voice call active</p>
          <p className="mt-1 text-emerald-50/90">
            Status: {state.call.status}
            {state.call.participantName ? ` · ${state.call.participantName}` : ""}
          </p>
          {state.call.dialerUrl && (
            <p className="mt-1">
              Dialer: {" "}
              <a href={state.call.dialerUrl} target="_blank" rel="noreferrer" className="underline">
                Open mock bridge
              </a>
            </p>
          )}
          {state.call.expiresAt && (
            <p className="mt-1 text-xs text-emerald-100/70">
              Expires {formatTimestamp(state.call.expiresAt)}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <form action={formAction} className="inline-flex">
          <input type="hidden" name="intent" value="initiate" />
          <SubmitButton
            pendingLabel="Connecting…"
            className={buttonClassName("glass")}
            disabled={state.status === "offline"}
          >
            Start mock voice call
          </SubmitButton>
        </form>
        <form action={formAction} className="inline-flex">
          <input type="hidden" name="intent" value="summarize" />
          <SubmitButton
            pendingLabel="Summarizing…"
            className={buttonClassName("secondary")}
            disabled={!state.call || state.status === "offline"}
          >
            Log call summary
          </SubmitButton>
        </form>
      </div>
      {state.requestId && (
        <p className="text-xs text-white/50">Last request ID {state.requestId}</p>
      )}
      <ThreadStatusToast state={state} />
    </div>
  );
}

type ThreadEntryRowProps = {
  entry: ThreadEntry;
};

function ThreadEntryRow({ entry }: ThreadEntryRowProps) {
  const timestamp = formatTimestamp(entry.sent_at);
  const baseClass =
    entry.type === "call_summary"
      ? "border-sky-500/40 bg-sky-500/10"
      : entry.type === "call"
        ? "border-emerald-500/30 bg-emerald-500/10"
        : entry.type === "note"
          ? "border-white/20 bg-white/5"
          : "border-white/10 bg-white/5";

  return (
    <div className={`rounded-2xl border ${baseClass} p-4 text-sm text-white/80`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.2em] text-white/60">
        <span>
          {entry.type === "call_summary"
            ? "Call summary"
            : entry.type === "call"
              ? "Voice call"
              : entry.type === "note"
                ? "Ops note"
                : "WhatsApp"}
        </span>
        <span>{timestamp}</span>
      </div>
      <p className="mt-2 text-base text-white">{entry.body}</p>
      {entry.type === "call" && entry.dialer_url && (
        <p className="mt-2 text-xs text-white/70">
          Dialer: {" "}
          <a href={entry.dialer_url} className="underline" target="_blank" rel="noreferrer">
            {entry.dialer_url}
          </a>
        </p>
      )}
      {entry.type === "call_summary" && (
        <div className="mt-3 space-y-2 text-sm text-white/75">
          {entry.highlights && entry.highlights.length > 0 && (
            <div>
              <p className="font-semibold text-white">Highlights</p>
              <ul className="ml-4 list-disc space-y-1">
                {entry.highlights.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {entry.next_steps && entry.next_steps.length > 0 && (
            <div>
              <p className="font-semibold text-white">Next steps</p>
              <ul className="ml-4 list-disc space-y-1">
                {entry.next_steps.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {entry.sentiment && (
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/80">
              Sentiment: {entry.sentiment}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ThreadStatusToast({ state }: { state: ContactThreadState }) {
  if (state.status === "idle") return null;

  const tone = state.status === "success" ? "success" : state.status === "offline" ? "warning" : "error";
  const title =
    state.status === "success"
      ? "Thread updated"
      : state.status === "offline"
        ? "Voice stack offline"
        : "Voice action failed";
  const description = state.detail ?? state.message ?? "Check voice-call logs for more detail.";

  return <Toast id={`${initialStatusToastId}-${tone}`} title={title} description={description} onDismiss={() => undefined} />;
}

function SubmitButton({
  children,
  pendingLabel,
  className,
  disabled,
}: {
  children: string;
  pendingLabel: string;
  className: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={disabled || pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

function formatTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
