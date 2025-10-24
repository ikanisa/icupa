"use client";

import { useMemo, useState } from "react";
import {
  OptimizerInput as OptimizerInputSchema,
  type OptimizerInput as OptimizerInputType,
} from "@ecotrips/types";
import { buttonClassName } from "@ecotrips/ui";

import beforeFixture from "../fixtures/auto_balance_before.json" assert { type: "json" };
import afterFixture from "../fixtures/auto_balance_after.json" assert { type: "json" };

type OptimizerPlan = OptimizerInputType;

type Anchor = OptimizerPlan["anchors"][number];

type Diff = {
  id: string;
  label: string;
  kind: "move" | "adjust" | "lock";
  summary: string;
};

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function describeAnchorDiff(before: Anchor | undefined, after: Anchor | undefined): Diff | null {
  if (!after) {
    if (!before) return null;
    return {
      id: before.id,
      label: before.label,
      kind: "lock",
      summary: `${before.label} removed from plan`,
    };
  }
  if (!before) {
    return {
      id: after.id,
      label: after.label,
      kind: "move",
      summary: `${after.label} added to ${after.day_id} at ${formatMinutes(after.start_minute ?? 0)}`,
    };
  }

  const dayChanged = before.day_id !== after.day_id;
  const startChanged = before.start_minute !== after.start_minute;
  const endChanged = before.end_minute !== after.end_minute;

  if (!dayChanged && !startChanged && !endChanged) {
    return null;
  }

  const parts: string[] = [];
  if (dayChanged) {
    parts.push(`moved from ${before.day_id} to ${after.day_id}`);
  }
  if (startChanged) {
    parts.push(
      `start ${formatMinutes(before.start_minute ?? 0)} → ${formatMinutes(after.start_minute ?? 0)}`,
    );
  }
  if (endChanged) {
    parts.push(
      `end ${formatMinutes(before.end_minute ?? 0)} → ${formatMinutes(after.end_minute ?? 0)}`,
    );
  }

  return {
    id: after.id,
    label: after.label,
    kind: dayChanged ? "move" : "adjust",
    summary: `${after.label} ${parts.join(", ")}`,
  };
}

export function AutoBalanceDayControl() {
  const beforePlan = useMemo(
    () => OptimizerInputSchema.parse(beforeFixture as Record<string, unknown>),
    [],
  );
  const afterPlan = useMemo(
    () =>
      OptimizerInputSchema
        .passthrough()
        .parse(afterFixture as Record<string, unknown>) as OptimizerPlan,
    [],
  );
  const afterRationales = useMemo(() => {
    const raw = (afterFixture as { rationales?: unknown }).rationales;
    return Array.isArray(raw)
      ? raw.filter((item): item is string => typeof item === "string")
      : [];
  }, []);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [workingPlan, setWorkingPlan] = useState<OptimizerPlan>(beforePlan);
  const [whyChanges, setWhyChanges] = useState<string[]>([]);

  const anchorDiffs = useMemo(() => {
    const map = new Map<string, Diff>();
    const beforeMap = new Map(beforePlan.anchors.map((anchor) => [anchor.id, anchor]));
    const afterMap = new Map(afterPlan.anchors.map((anchor) => [anchor.id, anchor]));
    const ids = new Set([...beforeMap.keys(), ...afterMap.keys()]);
    for (const id of ids) {
      const diff = describeAnchorDiff(beforeMap.get(id), afterMap.get(id));
      if (diff) {
        map.set(id, diff);
      }
    }
    return Array.from(map.values());
  }, [beforePlan, afterPlan]);

  const applied = useMemo(() => {
    const baseline = JSON.stringify(beforePlan.anchors);
    const current = JSON.stringify(workingPlan.anchors);
    return baseline !== current;
  }, [beforePlan, workingPlan]);

  const handleTogglePreview = () => {
    setPreviewOpen((value) => !value);
  };

  const handleApply = () => {
    setWorkingPlan(afterPlan);
    setWhyChanges((existing) => {
      const merged = new Set(existing);
      for (const note of afterRationales) {
        merged.add(`Auto-balance: ${note}`);
      }
      return Array.from(merged);
    });
    setPreviewOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Auto-balance day plan</p>
          <p className="text-xs text-white/70">
            PlannerCoPilot simulates conflict resolution using fixtures so teams can document the before/after rhythm.
          </p>
        </div>
        <button
          type="button"
          className={buttonClassName(previewOpen ? "secondary" : "glass")}
          onClick={handleTogglePreview}
        >
          {previewOpen ? "Close preview" : "Auto-balance day"}
        </button>
      </div>

      {previewOpen ? (
        <div className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <div>
            <p className="text-sm font-semibold text-white">Proposed adjustments</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-white/80">
              {anchorDiffs.map((diff) => (
                <li key={diff.id}>
                  <span className="font-medium text-white">{diff.label}</span>: {diff.summary}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Why these changes</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-white/80">
              {afterRationales.map((note, index) => (
                <li key={`${note}-${index}`}>{note}</li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <details className="rounded border border-white/10 bg-black/30 p-3 text-xs text-white/80">
              <summary className="cursor-pointer font-semibold text-white">Before JSON</summary>
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words">
                {JSON.stringify(beforeFixture, null, 2)}
              </pre>
            </details>
            <details className="rounded border border-white/10 bg-black/30 p-3 text-xs text-white/80">
              <summary className="cursor-pointer font-semibold text-white">After JSON</summary>
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words">
                {JSON.stringify(afterFixture, null, 2)}
              </pre>
            </details>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClassName("primary")}
              onClick={handleApply}
            >
              Apply to working plan
            </button>
            {applied ? (
              <span className="rounded-full border border-emerald-400/60 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
                Applied
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-semibold text-white">Working plan snapshot</p>
        <p className="mt-1 text-xs text-white/70">
          Anchors stored in working_plan memory ({workingPlan.anchors.length} items). Auto-balance updates merge before Supabase bundle generation.
        </p>
        {whyChanges.length > 0 ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
              Why these changes
            </p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-white/80">
              {whyChanges.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-xs text-white/60">No optimizer context captured yet.</p>
        )}
      </div>
    </div>
  );
}
