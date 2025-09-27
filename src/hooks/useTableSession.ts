import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import {
  clearTableSession,
  getStoredTableSession,
  storeTableSession,
  type StoredTableSession,
  getTimeUntilExpiration,
} from "@/lib/table-session";
import { computeDeviceFingerprint } from "@/lib/device-fingerprint";

interface TableSessionResponse {
  table_session_id: string;
  table_id: string;
  location_id: string | null;
  expires_at: string;
}

type SessionStatus = "idle" | "linking" | "ready" | "error";

const EXPIRY_WARNING_MS = 5 * 60 * 1000; // 5 minutes
const EXPIRY_REFRESH_INTERVAL_MS = 30 * 1000;

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
  const [timeRemainingMs, setTimeRemainingMs] = useState<number | null>(() =>
    session ? getTimeUntilExpiration(session.expiresAt) : null
  );
  const expirationToastShown = useRef(false);
  const warningToastShown = useRef(false);

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
        setTimeRemainingMs(getTimeUntilExpiration(newSession.expiresAt));
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
      setTimeRemainingMs(null);
      if (status !== "linking") {
        setStatus("idle");
      }
      return;
    }
    setSession(stored);
    setTimeRemainingMs(getTimeUntilExpiration(stored.expiresAt));
    if (status === "idle") {
      setStatus("ready");
    }
  }, [status]);

  const clearSession = useCallback(() => {
    clearTableSession();
    setSession(null);
    setStatus("idle");
    setTimeRemainingMs(null);
  }, []);

  useEffect(() => {
    expirationToastShown.current = false;
    warningToastShown.current = false;
    if (!session) {
      setTimeRemainingMs(null);
      return;
    }
    setTimeRemainingMs(getTimeUntilExpiration(session.expiresAt));

    if (typeof window === "undefined") {
      return;
    }

    const updateRemaining = () => {
      const remaining = getTimeUntilExpiration(session.expiresAt);
      setTimeRemainingMs(remaining);

      if (remaining !== null && remaining <= 0 && !expirationToastShown.current) {
        expirationToastShown.current = true;
        toast({
          title: "Table session expired",
          description: "Scan the table QR again to continue ordering from this device.",
          variant: "destructive",
        });
        clearSession();
        return;
      }

      if (
        remaining !== null &&
        remaining > 0 &&
        remaining <= EXPIRY_WARNING_MS &&
        !warningToastShown.current
      ) {
        warningToastShown.current = true;
        toast({
          title: "Table session ending soon",
          description: "Rescan the table QR to refresh your session before it expires.",
        });
      }
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, EXPIRY_REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [session, clearSession]);

  return useMemo(
    () => ({
      session,
      status,
      clearSession,
      linkWithToken: initializeSession,
      expiresAt: session?.expiresAt ?? null,
      timeRemainingMs,
    }),
    [clearSession, initializeSession, session, status, timeRemainingMs]
  );
}
