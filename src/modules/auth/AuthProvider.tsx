import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AuthSnapshot, AppUserRole } from "./types";

const roleSchema = z
  .array(z.enum(["admin", "merchant", "client"]))
  .or(z.enum(["admin", "merchant", "client"]).transform((value) => [value]))
  .catch([]);

const AuthContext = createContext<AuthSnapshot | undefined>(undefined);

const resolveRoles = (session: Session | null): AppUserRole[] => {
  if (!session) {
    return ["guest"];
  }
  const metadata = session.user?.app_metadata ?? {};
  const rawRoles = roleSchema.parse(metadata.roles ?? metadata.role ?? []);
  if (rawRoles.length === 0) {
    return ["client"];
  }
  return rawRoles as AppUserRole[];
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [snapshot, setSnapshot] = useState<Omit<AuthSnapshot, "refresh">>(() => ({
    status: "loading",
    roles: ["guest"],
  }));

  useEffect(() => {
    let active = true;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;

    const initialise = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSnapshot({
        status: data.session ? "authenticated" : "unauthenticated",
        roles: resolveRoles(data.session),
        email: data.session?.user?.email ?? undefined,
      });
    };

    void initialise();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSnapshot({
        status: session ? "authenticated" : "unauthenticated",
        roles: resolveRoles(session),
        email: session?.user?.email ?? undefined,
      });
    });

    refreshTimer = setInterval(() => {
      void supabase.auth.refreshSession();
    }, 15 * 60 * 1000);

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
    };
  }, []);

  const value = useMemo<AuthSnapshot>(
    () => ({
      ...snapshot,
      refresh: async () => {
        await supabase.auth.refreshSession();
      },
    }),
    [snapshot],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
