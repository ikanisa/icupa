"use client";

import { ReactNode, useEffect } from "react";

import { initAxe } from "../../../../lib/a11y/axe";
import { FunctionClientProvider } from "../../../../lib/api/client-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    void initAxe();
  }, []);

  return <FunctionClientProvider>{children}</FunctionClientProvider>;
}
