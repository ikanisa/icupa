"use client";

import { useContext, useMemo } from "react";
import { shouldEnablePlannerV2 } from "@ecotrips/config/feature-flags";

import { PlannerRolloutContext } from "./PlannerRolloutContext";

function readBucketFromDocument() {
  if (typeof document === "undefined") {
    return undefined;
  }

  const match = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("planner_rollout_bucket="));

  if (!match) {
    return undefined;
  }

  const value = match.split("=")[1];
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function usePlannerRollout() {
  const evaluation = useContext(PlannerRolloutContext);

  return useMemo(() => {
    if (evaluation) {
      return evaluation;
    }

    const bucket = readBucketFromDocument();
    return shouldEnablePlannerV2({ bucket });
  }, [evaluation]);
}
