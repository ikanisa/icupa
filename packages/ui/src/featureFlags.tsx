"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type FeatureFlagKey =
  | "client.explain_price.glass"
  | "client.autonomy_dial"
  | "client.suggestion_chips.top";

type FeatureFlagsShape = Record<FeatureFlagKey, boolean>;

type FeatureFlagsContextValue = {
  flags: FeatureFlagsShape;
  ready: boolean;
  refresh: () => Promise<void>;
};

const DEFAULT_FLAGS: FeatureFlagsShape = {
  "client.explain_price.glass": false,
  "client.autonomy_dial": false,
  "client.suggestion_chips.top": false,
};

const FeatureFlagsContext = createContext<FeatureFlagsContextValue>({
  flags: DEFAULT_FLAGS,
  ready: false,
  refresh: async () => {
    // no-op fallback
  },
});

async function fetchFlags(endpoint: string): Promise<FeatureFlagsShape> {
  try {
    const response = await fetch(endpoint, {
      headers: { "content-type": "application/json" },
    });
    if (!response.ok) {
      throw new Error(`flags-config responded with ${response.status}`);
    }
    const data = (await response.json()) as {
      features?: Record<string, boolean>;
    };
    const features = data.features ?? {};
    return {
      "client.explain_price.glass": Boolean(features["client.explain_price.glass"]),
      "client.autonomy_dial": Boolean(features["client.autonomy_dial"]),
      "client.suggestion_chips.top": Boolean(features["client.suggestion_chips.top"]),
    };
  } catch (error) {
    console.warn("flags-config fetch failed", error);
    return DEFAULT_FLAGS;
  }
}

export function FeatureFlagsProvider({
  children,
  endpoint = "/functions/v1/flags-config",
  initialFlags,
}: {
  children: React.ReactNode;
  endpoint?: string;
  initialFlags?: Partial<Record<FeatureFlagKey, boolean>>;
}) {
  const [flags, setFlags] = useState<FeatureFlagsShape>(() => ({
    ...DEFAULT_FLAGS,
    ...(initialFlags ?? {}),
  } as FeatureFlagsShape));
  const [ready, setReady] = useState(Boolean(initialFlags));

  const refresh = useCallback(async () => {
    const nextFlags = await fetchFlags(endpoint);
    setFlags(nextFlags);
    setReady(true);
  }, [endpoint]);

  useEffect(() => {
    if (!ready) {
      refresh().catch((error) => {
        console.error("flags-config refresh failed", error);
      });
    }
  }, [ready, refresh]);

  const value = useMemo<FeatureFlagsContextValue>(() => ({ flags, ready, refresh }), [flags, ready, refresh]);

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlags(): FeatureFlagsContextValue {
  return useContext(FeatureFlagsContext);
}

export function useFeatureFlag(flag: FeatureFlagKey): boolean {
  const { flags } = useFeatureFlags();
  return flags[flag];
}
