"use client";

import { useState } from "react";
import Link from "next/link";

import { ExplainPrice, buttonClassName } from "@ecotrips/ui";
import type { PriceBreakdown } from "@ecotrips/types";

type ChatOption = {
  id: string;
  label: string;
  description: string;
  actionHref: string;
  actionLabel: string;
};

type ChatOptionModalsProps = {
  breakdowns: Record<string, PriceBreakdown | undefined>;
};

const chatOptions: ChatOption[] = [
  {
    id: "support-whatsapp",
    label: "Chat on WhatsApp",
    description: "ConciergeGuide responds in under 15 minutes with human escalation on standby.",
    actionHref: "https://wa.me/250789123456",
    actionLabel: "Open WhatsApp",
  },
  {
    id: "support-refund",
    label: "Request refund",
    description: "Submit refund triage with audit logging and HITL approvals.",
    actionHref: "/support?refund=1",
    actionLabel: "Start refund form",
  },
];

export function ChatOptionModals({ breakdowns }: ChatOptionModalsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeOption = chatOptions.find((option) => option.id === activeId) ?? null;

  return (
    <div className="mt-4 flex flex-wrap gap-3">
      {chatOptions.map((option) => (
        <button
          key={option.id}
          type="button"
          className={buttonClassName(option.id === "support-refund" ? "secondary" : "glass")}
          onClick={() => setActiveId(option.id)}
        >
          {option.label}
        </button>
      ))}
      {activeId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${activeId}-title`}
        >
          <div className="w-full max-w-lg space-y-4 rounded-3xl border border-white/10 bg-slate-900/95 p-6 text-white shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={`${activeId}-title`} className="text-lg font-semibold tracking-tight">
                  {activeOption?.label ?? "Support"}
                </h2>
                <p className="mt-1 text-sm text-white/70">
                  {activeOption?.description ?? "Support option details."}
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-white/60 transition hover:text-white"
                onClick={() => setActiveId(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {(() => {
              const breakdown = breakdowns[activeId ?? ""] ?? undefined;
              if (!breakdown) {
                return (
                  <p className="text-sm text-white/70">
                    Pricing breakdown unavailable. Fixtures will refresh once helpers-price edge function responds.
                  </p>
                );
              }
              return <ExplainPrice breakdown={breakdown} headline="Support pricing" />;
            })()}
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-white/80">
              <Link
                href={activeOption?.actionHref ?? "#"}
                className={buttonClassName("glass")}
              >
                {activeOption?.actionLabel ?? "Continue"}
              </Link>
              <button
                type="button"
                className="text-xs uppercase tracking-wide text-white/60"
                onClick={() => setActiveId(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
