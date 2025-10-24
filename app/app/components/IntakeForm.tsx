"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ClientCreate, ClientCreateSchema, splitCommaList } from "../lib/client-intake";

type ToastState = { intent: "success" | "error"; message: string } | null;
type IntentValues = NonNullable<ClientCreate["intent"]>;

const defaultValues: ClientCreate = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  intent: {
    travelWindow: "",
    partySize: undefined,
    destinations: [],
    impactFocuses: [],
    experienceStyles: [],
    budgetMin: undefined,
    budgetMax: undefined,
  },
  notes: "",
};

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = "We couldn't save your request right now. Try again shortly.";
  try {
    const text = await response.text();
    if (!text) return fallback;

    try {
      const data = JSON.parse(text) as { message?: unknown; error?: unknown };
      if (typeof data.message === "string" && data.message.trim().length > 0) {
        return data.message.trim();
      }
      if (typeof data.error === "string" && data.error.trim().length > 0) {
        return data.error.trim();
      }
    } catch {
      /* swallow */
    }

    return text.trim().length > 0 ? text.trim() : fallback;
  } catch {
    return fallback;
  }
}

function normalizeIntent(intent: ClientCreate["intent"]): ClientCreate["intent"] {
  if (!intent) return undefined;

  const next: IntentValues = {};

  if (typeof intent.travelWindow === "string" && intent.travelWindow.trim().length > 0) {
    next.travelWindow = intent.travelWindow.trim();
  }

  if (typeof intent.partySize === "number" && !Number.isNaN(intent.partySize)) {
    next.partySize = intent.partySize;
  }

  if (Array.isArray(intent.destinations)) {
    const destinations = intent.destinations.map((item) => item.trim()).filter((item) => item.length > 0);
    if (destinations.length > 0) {
      next.destinations = destinations;
    }
  }

  if (Array.isArray(intent.impactFocuses)) {
    const focuses = intent.impactFocuses.map((item) => item.trim()).filter((item) => item.length > 0);
    if (focuses.length > 0) {
      next.impactFocuses = focuses;
    }
  }

  if (Array.isArray(intent.experienceStyles)) {
    const experiences = intent.experienceStyles.map((item) => item.trim()).filter((item) => item.length > 0);
    if (experiences.length > 0) {
      next.experienceStyles = experiences;
    }
  }

  if (typeof intent.budgetMin === "number" && !Number.isNaN(intent.budgetMin)) {
    next.budgetMin = intent.budgetMin;
  }

  if (typeof intent.budgetMax === "number" && !Number.isNaN(intent.budgetMax)) {
    next.budgetMax = intent.budgetMax;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

export function IntakeForm() {
  const [toast, setToast] = useState<ToastState>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientCreate>({
    resolver: zodResolver(ClientCreateSchema),
    defaultValues,
  });

  const onSubmit = handleSubmit(async (values) => {
    setToast(null);

    const phone = values.phone?.trim();
    const notes = values.notes?.trim();

    const payload: ClientCreate = {
      companyName: values.companyName.trim(),
      contactName: values.contactName.trim(),
      email: values.email.trim(),
      phone: phone && phone.length > 0 ? phone : undefined,
      intent: normalizeIntent(values.intent),
      notes: notes && notes.length > 0 ? notes : undefined,
    };

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await readErrorMessage(response);
        throw new Error(message);
      }

      setToast({ intent: "success", message: "Thanks! Our concierge team will follow up shortly." });
      reset(defaultValues);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "We couldn't save your request right now. Try again shortly.";
      setToast({ intent: "error", message });
    }
  });

  return (
    <div className="card" role="region" aria-label="Client intake form">
      <div className="row" style={{ marginBottom: 16 }}>
        <span className="badge">Client intake</span>
        <span className="badge">Atlas styling</span>
      </div>
      <div className="h1">Share your travel priorities</div>
      <p className="subtle">
        Tell us who you are and the outcomes you&apos;re driving so our operators can tailor the right mix of
        suppliers, destinations, and regenerative experiences.
      </p>

      <form className="grid" style={{ gap: 16 }} onSubmit={onSubmit} noValidate>
        <section className="grid" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 240px" }}>
              <span className="label">Company or organization</span>
              <input
                className="input"
                placeholder="Rivera Collective"
                {...register("companyName")}
              />
              {errors.companyName ? (
                <span className="subtle" style={{ color: "#FFC5C5" }}>
                  {errors.companyName.message}
                </span>
              ) : null}
            </label>
            <label style={{ flex: "1 1 240px" }}>
              <span className="label">Primary contact</span>
              <input className="input" placeholder="Jordan Rivera" {...register("contactName")} />
              {errors.contactName ? (
                <span className="subtle" style={{ color: "#FFC5C5" }}>
                  {errors.contactName.message}
                </span>
              ) : null}
            </label>
          </div>

          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 240px" }}>
              <span className="label">Work email</span>
              <input className="input" type="email" placeholder="hello@rivera.co" {...register("email")} />
              {errors.email ? (
                <span className="subtle" style={{ color: "#FFC5C5" }}>
                  {errors.email.message}
                </span>
              ) : null}
            </label>
            <label style={{ flex: "1 1 240px" }}>
              <span className="label">Phone (optional)</span>
              <input className="input" placeholder="+1 415-555-2048" {...register("phone")} />
            </label>
          </div>
        </section>

        <section className="grid" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 220px" }}>
              <span className="label">Ideal travel window</span>
              <input
                className="input"
                placeholder="Q4 2025 or flexible"
                {...register("intent.travelWindow")}
              />
            </label>
            <label style={{ flex: "1 1 220px" }}>
              <span className="label">Estimated party size</span>
              <input
                className="input"
                type="number"
                min={1}
                placeholder="32"
                {...register("intent.partySize", {
                  setValueAs: (value) => {
                    if (value === "" || value === null || typeof value === "undefined") {
                      return undefined;
                    }
                    const parsed = Number(value);
                    return Number.isNaN(parsed) ? undefined : parsed;
                  },
                })}
              />
              {errors.intent?.partySize ? (
                <span className="subtle" style={{ color: "#FFC5C5" }}>
                  {errors.intent.partySize.message}
                </span>
              ) : null}
            </label>
          </div>

          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <Controller
              control={control}
              name="intent.destinations"
              render={({ field }) => (
                <label style={{ flex: "1 1 280px" }}>
                  <span className="label">Destinations in play</span>
                  <input
                    className="input"
                    placeholder="Costa Rica, Kigali, Patagonia"
                    value={(field.value ?? []).join(", ")}
                    onChange={(event) => field.onChange(splitCommaList(event.target.value))}
                  />
                </label>
              )}
            />
            <Controller
              control={control}
              name="intent.impactFocuses"
              render={({ field }) => (
                <label style={{ flex: "1 1 280px" }}>
                  <span className="label">Impact focus areas</span>
                  <input
                    className="input"
                    placeholder="Reforestation, youth climate, fair-trade supply"
                    value={(field.value ?? []).join(", ")}
                    onChange={(event) => field.onChange(splitCommaList(event.target.value))}
                  />
                </label>
              )}
            />
          </div>

          <Controller
            control={control}
            name="intent.experienceStyles"
            render={({ field }) => (
              <label>
                <span className="label">Experience styles to prioritize</span>
                <input
                  className="input"
                  placeholder="Hands-on conservation, executive retreats, cultural immersion"
                  value={(field.value ?? []).join(", ")}
                  onChange={(event) => field.onChange(splitCommaList(event.target.value))}
                />
              </label>
            )}
          />

          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 220px" }}>
              <span className="label">Budget minimum (USD)</span>
              <input
                className="input"
                type="number"
                min={0}
                placeholder="250000"
                {...register("intent.budgetMin", {
                  setValueAs: (value) => {
                    if (value === "" || value === null || typeof value === "undefined") {
                      return undefined;
                    }
                    const parsed = Number(value);
                    return Number.isNaN(parsed) ? undefined : parsed;
                  },
                })}
              />
              {errors.intent?.budgetMin ? (
                <span className="subtle" style={{ color: "#FFC5C5" }}>
                  {errors.intent.budgetMin.message}
                </span>
              ) : null}
            </label>
            <label style={{ flex: "1 1 220px" }}>
              <span className="label">Budget maximum (USD)</span>
              <input
                className="input"
                type="number"
                min={0}
                placeholder="400000"
                {...register("intent.budgetMax", {
                  setValueAs: (value) => {
                    if (value === "" || value === null || typeof value === "undefined") {
                      return undefined;
                    }
                    const parsed = Number(value);
                    return Number.isNaN(parsed) ? undefined : parsed;
                  },
                })}
              />
              {errors.intent?.budgetMax ? (
                <span className="subtle" style={{ color: "#FFC5C5" }}>
                  {errors.intent.budgetMax.message}
                </span>
              ) : null}
            </label>
          </div>
        </section>

        <section className="grid" style={{ gap: 12 }}>
          <label>
            <span className="label">Notes for our concierge team</span>
            <textarea
              className="textarea"
              rows={4}
              placeholder="Share any guardrails, stakeholders to consider, or integrations we should prep."
              {...register("notes")}
            />
            {errors.notes ? (
              <span className="subtle" style={{ color: "#FFC5C5" }}>
                {errors.notes.message}
              </span>
            ) : null}
          </label>
        </section>

        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
            style={{ minWidth: 180 }}
          >
            {isSubmitting ? "Sending..." : "Submit intake"}
          </button>
          <span className="subtle">We reply within one business day for funded partners.</span>
        </div>
      </form>

      {toast ? (
        <div className={`toast${toast.intent === "error" ? " error" : ""}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
