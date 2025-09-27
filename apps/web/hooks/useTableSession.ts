import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { toast } from "@icupa/ui/use-toast";
import {
  clearTableSession,
  getStoredTableSession,
  storeTableSession,
  type StoredTableSession,
} from "@/lib/table-session";
import { computeDeviceFingerprint } from "@/lib/device-fingerprint";

interface TableSessionResponse {
  table_session_id: string;
  table_id: string;
  location_id: string | null;
  expires_at: string;
}

type SessionStatus = "idle" | "linking" | "ready" | "error";

function removeQrParams() {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.delete("qr");
  url.searchParams.delete("sig");
  window.history.replaceState({}, "", url.toString());
}

export function useTableSession() {
  const [session, setSession] = useState<StoredTableSession | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return getStoredTableSession();
  });
  const [status, setStatus] = useState<SessionStatus>(() =>
    session ? "ready" : "idle"
  );
  const [pendingQr, setPendingQr] = useState<{ token: string; signature: string } | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    const params = new URLSearchParams(window.location.search);
    const token = params.get("qr");
    const signature = params.get("sig");
    if (token && signature) {
      return { token, signature };
    }
    return null;
  });

  const initializeSession = useCallback(
    async (token: string, signature: string) => {
      setStatus("linking");
      try {
        const fingerprint = await computeDeviceFingerprint();
        const { data, error } = await supabase.functions.invoke<TableSessionResponse>(
          "create_table_session",
          {
            body: {
              qr_token: token,
              signature,
              device_fingerprint: fingerprint,
            },
          }
        );

        if (error || !data) {
          throw new Error(error?.message ?? "Unable to create table session");
        }

        const newSession: StoredTableSession = {
          id: data.table_session_id,
          tableId: data.table_id,
          locationId: data.location_id,
          expiresAt: data.expires_at,
        };

        storeTableSession(newSession);
        setSession(newSession);
        setStatus("ready");
        toast({
          title: "Table linked",
          description: "Orders from this device are now scoped to your table.",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error";
        setStatus("error");
        toast({
          title: "Table session error",
          description: message,
          variant: "destructive",
        });
      } finally {
        removeQrParams();
        setPendingQr(null);
      }
    },
    []
  );

  useEffect(() => {
    if (!pendingQr) {
      return;
    }
    initializeSession(pendingQr.token, pendingQr.signature);
  }, [initializeSession, pendingQr]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = getStoredTableSession();
    if (!stored) {
      clearTableSession();
      setSession(null);
      if (status !== "linking") {
        setStatus("idle");
      }
      return;
    }
    setSession(stored);
    if (status === "idle") {
      setStatus("ready");
    }
  }, [status]);

  const clearSession = useCallback(() => {
    clearTableSession();
    setSession(null);
    setStatus("idle");
  }, []);

  return useMemo(
    () => ({
      session,
      status,
      clearSession,
    }),
    [clearSession, session, status]
  );
}
