import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { shouldEnablePlannerV2 } from "@ecotrips/config/feature-flags";

import { PlannerRolloutContext } from "./PlannerRolloutContext";

export type PlannerFlagEvaluation = ReturnType<typeof shouldEnablePlannerV2>;

type PlannerFeatureGateProps = {
  children: ReactNode;
  fallback?: ReactNode | ((evaluation: PlannerFlagEvaluation) => ReactNode);
  bucket?: number;
  debugLabel?: string;
};

export function PlannerFeatureGate({
  children,
  fallback = null,
  bucket,
  debugLabel,
}: PlannerFeatureGateProps) {
  const evaluation = shouldEnablePlannerV2({ bucket: bucket ?? getPlannerBucket() });

  if (process.env.NODE_ENV !== "production" && debugLabel) {
    console.debug(`PlannerFeatureGate(${debugLabel})`, evaluation);
  }

  const content = evaluation.enabled
    ? children
    : typeof fallback === "function"
      ? fallback(evaluation)
      : fallback;

  return <PlannerRolloutContext.Provider value={evaluation}>{content}</PlannerRolloutContext.Provider>;
}

const PLANNER_ROLLOUT_COOKIE = "planner_rollout_bucket";

function getPlannerBucket() {
  const store = cookies();
  const existing = store.get(PLANNER_ROLLOUT_COOKIE);
  const parsed = existing ? Number.parseFloat(existing.value) : Number.NaN;

  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
    return parsed;
  }

  const generated = Number(Math.random().toFixed(6));

  try {
    store.set({
      name: PLANNER_ROLLOUT_COOKIE,
      value: generated.toString(),
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
  } catch (error) {
    console.warn("PlannerFeatureGate: unable to persist rollout bucket", error);
  }

  return generated;
}
