import { QueryClientProvider, focusManager } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createQueryClient } from "./queryClient";

interface QueryProviderProps {
  children: ReactNode;
}

export const QueryProvider = ({ children }: QueryProviderProps) => {
  const [client] = useState(() => createQueryClient());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const unsubscribe = focusManager.setEventListener((handleFocus) => {
      const listener = () => handleFocus(!document.hidden);
      window.addEventListener("visibilitychange", listener);
      window.addEventListener("focus", listener);
      return () => {
        window.removeEventListener("visibilitychange", listener);
        window.removeEventListener("focus", listener);
      };
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
