import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTableSessionHeader } from "@/lib/table-session";
import { SupabaseSessionContext } from "./session-context";
const TABLE_SESSION_EVENT = "icupa:table-session";

interface SupabaseSessionProviderProps {
  children: ReactNode;
}

export const SupabaseSessionProvider = ({ children }: SupabaseSessionProviderProps) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tableSessionId, setTableSessionId] = useState<string | null>(() => getTableSessionHeader());

  useEffect(() => {
    let active = true;

    void supabase.auth.startAutoRefresh();

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) {
        return;
      }
      setAccessToken(data.session?.access_token ?? null);
    };

    void syncSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
    });

    if (typeof window !== "undefined") {
      const updateTableSession = () => {
        setTableSessionId(getTableSessionHeader());
      };

      const handleStorage = (event: StorageEvent) => {
        if (event.key === "icupa_table_session") {
          updateTableSession();
        }
      };

      const handleCustomEvent: EventListener = () => {
        updateTableSession();
      };

      window.addEventListener("focus", updateTableSession);
      window.addEventListener("storage", handleStorage);
      window.addEventListener(TABLE_SESSION_EVENT, handleCustomEvent);

      return () => {
        active = false;
        authListener.subscription.unsubscribe();
        window.removeEventListener("focus", updateTableSession);
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(TABLE_SESSION_EVENT, handleCustomEvent);
        void supabase.auth.stopAutoRefresh();
      };
    }

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
      void supabase.auth.stopAutoRefresh();
    };
  }, []);

  const headers = useMemo(() => {
    const next: Record<string, string> = {};
    if (accessToken) {
      next.Authorization = `Bearer ${accessToken}`;
    }
    if (tableSessionId) {
      next["x-icupa-session"] = tableSessionId;
    }
    return next;
  }, [accessToken, tableSessionId]);

  return <SupabaseSessionContext.Provider value={headers}>{children}</SupabaseSessionContext.Provider>;
};
