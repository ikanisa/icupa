import { createContext } from "react";
import type { PercentageFlagEvaluation } from "@ecotrips/config/feature-flags";

export type PlannerRolloutEvaluation = PercentageFlagEvaluation;

export const PlannerRolloutContext = createContext<PlannerRolloutEvaluation | null>(null);
