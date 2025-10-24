"use client";

import { useState, useTransition } from "react";

type LeadPayload = {
  name: string;
  email: string;
  travelMonth: string;
  groupType: string;
  message: string;
  consent: boolean;
};

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; leadName: string }
  | { status: "error"; error: string };

function isValidEmail(value: string) {
  return /.+@.+\..+/.test(value);
}

async function readErrorMessage(response: Response) {
  const fallback = `We couldn't submit your request (status ${response.status}). Please try again shortly.`;
  try {
    const raw = await response.text();
    if (!raw) return fallback;

    try {
      const parsed = JSON.parse(raw) as { message?: unknown; errors?: unknown };
      if (parsed && typeof parsed.message === "string" && parsed.message.trim().length > 0) {
        return parsed.message.trim();
      }
      if (Array.isArray(parsed?.errors) && parsed.errors.length > 0) {
        const first = parsed.errors[0];
        if (typeof first === "string" && first.trim().length > 0) {
          return first.trim();
        }
      }
    } catch {
      // fall through to raw text
    }

    return raw.trim().length > 0 ? raw.trim() : fallback;
  } catch {
    return fallback;
  }
}

export function LeadCaptureForm() {
  const [payload, setPayload] = useState<LeadPayload>({
    name: "",
    email: "",
    travelMonth: "",
    groupType: "",
    message: "",
    consent: false,
  });
  const [state, setState] = useState<SubmitState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();

  function updateField<K extends keyof LeadPayload>(key: K, value: LeadPayload[K]) {
    setPayload((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payload.name.trim()) {
      setState({ status: "error", error: "Add your name so we know how to address you." });
      return;
    }
    if (!isValidEmail(payload.email)) {
      setState({ status: "error", error: "Enter a valid email so we can follow up." });
      return;
    }
    if (!payload.consent) {
      setState({ status: "error", error: "Please acknowledge our privacy consent statement." });
      return;
    }

    setState({ status: "submitting" });
    startTransition(async () => {
      try {
        const response = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const message = await readErrorMessage(response);
          throw new Error(message || "Unable to submit lead right now.");
        }

        const result = (await response.json()) as { leadName?: string };
        setState({ status: "success", leadName: result.leadName ?? payload.name });
        setPayload({
          name: "",
          email: "",
          travelMonth: "",
          groupType: "",
          message: "",
          consent: false,
        });
      } catch (error) {
        setState({
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "We hit a snag while saving your request. Try again in a moment.",
        });
      }
    });
  }

  const disabled = isPending || state.status === "submitting";

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-3xl border border-emerald-500/40 bg-slate-950/50 p-6 shadow-[0_10px_45px_-24px_rgba(16,185,129,0.7)]"
      aria-describedby="lead-form-description"
    >
      <p id="lead-form-description" className="text-sm text-emerald-100/80">
        Tell us how you like to travel and an ecoTrips operator will craft a proposal with carbon insights,
        vetted suppliers, and a service agreement you can review with your stakeholders.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-emerald-100/90">
          Full name
          <input
            name="name"
            value={payload.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="rounded-xl border border-emerald-500/40 bg-slate-950/60 px-3 py-2 text-base text-white outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/60"
            placeholder="Rivera Collective"
            required
          />
        </label>

        <label className="grid gap-1 text-sm font-medium text-emerald-100/90">
          Email
          <input
            name="email"
            type="email"
            value={payload.email}
            onChange={(e) => updateField("email", e.target.value)}
            className="rounded-xl border border-emerald-500/40 bg-slate-950/60 px-3 py-2 text-base text-white outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/60"
            placeholder="hello@organization.com"
            required
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-emerald-100/90">
          Preferred departure month
          <input
            name="travelMonth"
            type="month"
            value={payload.travelMonth}
            onChange={(e) => updateField("travelMonth", e.target.value)}
            className="rounded-xl border border-emerald-500/40 bg-slate-950/60 px-3 py-2 text-base text-white outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/60"
          />
        </label>

        <label className="grid gap-1 text-sm font-medium text-emerald-100/90">
          Who&apos;s traveling?
          <select
            name="groupType"
            value={payload.groupType}
            onChange={(e) => updateField("groupType", e.target.value)}
            className="rounded-xl border border-emerald-500/40 bg-slate-950/60 px-3 py-2 text-base text-white outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/60"
          >
            <option value="">Select group type</option>
            <option value="couple">Couple or solo explorer</option>
            <option value="family">Family or multigenerational</option>
            <option value="team">Remote team retreat</option>
            <option value="education">School or university cohort</option>
            <option value="nonprofit">Nonprofit or donor trip</option>
          </select>
        </label>
      </div>

      <label className="grid gap-1 text-sm font-medium text-emerald-100/90">
        What kind of impact or experiences are you after?
        <textarea
          name="message"
          value={payload.message}
          onChange={(e) => updateField("message", e.target.value)}
          rows={4}
          className="rounded-xl border border-emerald-500/40 bg-slate-950/60 px-3 py-2 text-base text-white outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/60"
          placeholder="Think regenerative wine regions, youth climate curriculum, or rainforest conservation site visits."
        />
      </label>

      <label className="flex items-start gap-3 text-sm text-emerald-100/80">
        <input
          name="consent"
          type="checkbox"
          checked={payload.consent}
          onChange={(e) => updateField("consent", e.target.checked)}
          className="mt-1 h-4 w-4 rounded border border-emerald-500/50 bg-slate-950/80 text-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
          required
        />
        I agree to ecoTrips storing my details to follow up with itineraries and understand I can opt-out anytime.
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={disabled}
          className="rounded-full bg-emerald-500 px-6 py-3 text-base font-semibold text-emerald-950 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {disabled ? "Sending..." : "Request tailored proposals"}
        </button>
        <p className="text-sm text-emerald-100/70">Response SLA: under two business hours for funded travelers.</p>
      </div>

      {state.status === "error" ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
        >
          {state.error}
        </p>
      ) : null}

      {state.status === "success" ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
        >
          Thanks {state.leadName}! An operator will confirm details shortly.
        </p>
      ) : null}
    </form>
  );
}

