import { cache } from "react";

import { createAdminServerClient } from "./supabaseServer";

type FeatureFlagRecord = {
  key: string;
  enabled: boolean;
};

type FixtureRecord<T> = {
  key: string;
  payload: T;
};

export type FeatureFlaggedPayload<T> = {
  enabled: boolean;
  payload: T | null;
};

export const getFeatureFlaggedPayload = cache(async function getFeatureFlaggedPayload<T>(
  flagKey: string,
  fixtureKey: string,
): Promise<FeatureFlaggedPayload<T>> {
  const supabase = await createAdminServerClient();
  if (!supabase) {
    return { enabled: false, payload: null };
  }

  const [{ data: flag }, { data: fixture }] = await Promise.all([
    supabase.from<FeatureFlagRecord>("ops.console_feature_flags").select("key,enabled").eq("key", flagKey).maybeSingle(),
    supabase.from<FixtureRecord<T>>("ops.console_fixtures").select("key,payload").eq("key", fixtureKey).maybeSingle(),
  ]);

  if (!flag || !flag.enabled) {
    return { enabled: false, payload: null };
  }

  return {
    enabled: true,
    payload: fixture?.payload ?? null,
  };
});
