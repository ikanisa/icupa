"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useFeatureFlag } from "@ecotrips/ui";

import { useAnalytics } from "./useAnalytics";

const LEVELS = [
  { value: "assisted", label: "Assisted" },
  { value: "guided", label: "Guided" },
  { value: "autonomous", label: "Autonomous" },
] as const;

type Level = (typeof LEVELS)[number]["value"];

export function AutonomyDial() {
  const enabled = useFeatureFlag("client.autonomy_dial");
  const [level, setLevel] = useState<Level>("guided");
  const { track } = useAnalytics();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    track("autonomy_dial_viewed", { level });
  }, [enabled, level, track]);

  const markerClass = useMemo(
    () =>
      clsx(
        "absolute top-1/2 h-10 w-10 -translate-y-1/2 rounded-full border border-white/20",
        prefersReducedMotion ? "transition-none" : "transition-all duration-500 ease-out",
        {
          "left-[8%] bg-emerald-500/40": level === "assisted",
          "left-1/2 -translate-x-1/2 bg-sky-500/40": level === "guided",
          "right-[8%] bg-violet-500/40": level === "autonomous",
        },
      ),
    [level, prefersReducedMotion],
  );

  if (!enabled) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-semibold text-white">Autonomy dial</p>
          <p className="text-xs text-white/60">Tune PlannerCoPilot handoffs to suppliers.</p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-white/70">
          {level}
        </span>
      </header>
      <div className="relative mb-4 h-1 rounded-full bg-gradient-to-r from-emerald-500/40 via-sky-500/40 to-violet-500/40">
        <div className={markerClass} aria-hidden />
      </div>
      <div className="flex justify-between text-xs uppercase tracking-wide text-white/50">
        {LEVELS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              setLevel(item.value);
              track("autonomy_dial_changed", { level: item.value });
            }}
            className={clsx(
              "rounded-full px-3 py-1",
              level === item.value
                ? "bg-white/10 text-white"
                : "text-white/60 hover:text-white",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </section>
  );
}
