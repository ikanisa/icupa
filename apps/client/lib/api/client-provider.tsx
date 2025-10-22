"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import type { EcoTripsFunctionClient } from "@ecotrips/api";

import { createFunctionClient } from "./client";

const FunctionClientContext = createContext<EcoTripsFunctionClient | null>(null);

export function FunctionClientProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => createFunctionClient(), []);

  return <FunctionClientContext.Provider value={client}>{children}</FunctionClientContext.Provider>;
}

export function useFunctionClient(): EcoTripsFunctionClient {
  const client = useContext(FunctionClientContext);
  if (!client) {
    throw new Error("Function client is not available. Ensure FunctionClientProvider wraps the component tree.");
  }

  return client;
}

export function useOptionalFunctionClient(): EcoTripsFunctionClient | null {
  return useContext(FunctionClientContext);
}
