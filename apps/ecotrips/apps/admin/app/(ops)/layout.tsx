import "../../styles/globals.css";
import "@ecotrips/ui/styles/tokens.css";

import { CardGlass } from "@ecotrips/ui";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminNav } from "./_components/AdminNav";

import { createAdminServerClient } from "../../lib/supabaseServer";

const allowedRoles = new Set(["ops", "admin"]);

const defaultBypassHosts = Object.freeze(["localhost", "127.0.0.1"]);
const configuredBypassHosts = (process.env.OPS_CONSOLE_BYPASS_HOSTS ?? "")
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);
const allowedBypassHosts = new Set([
  ...defaultBypassHosts,
  ...configuredBypassHosts,
]);

const additionalLoopbackHosts = Object.freeze(["0.0.0.0", "[::1]"]);
additionalLoopbackHosts.forEach((host) => allowedBypassHosts.add(host));

const isDeployedRuntime = () => {
  if (process.env.NEXT_RUNTIME === "edge") {
    return true;
  }

  if (process.env.CI === "true") {
    return true;
  }

  return process.env.NODE_ENV === "production";
};

const resolveRequestHost = () => {
  try {
    const headerList = headers();
    const forwardedHost = headerList.get("x-forwarded-host");
    const directHost = headerList.get("host");
    const host = forwardedHost ?? directHost ?? "";
    return host.split(":")[0]?.toLowerCase?.() ?? "";
  } catch (error) {
    return "";
  }
};

type LayoutProps = {
  children: ReactNode;
};

export default async function OpsLayout({ children }: LayoutProps) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const bypassRequested = process.env.OPS_CONSOLE_BYPASS_AUTH === "1";
  const deployedRuntime = isDeployedRuntime();

  if (bypassRequested && deployedRuntime) {
    throw new Error("OPS_CONSOLE_BYPASS_AUTH is disabled for deployed environments.");
  }

  const requestHost = resolveRequestHost();
  const hostIsAllowlisted = requestHost ? allowedBypassHosts.has(requestHost) : false;

  if (bypassRequested && !hostIsAllowlisted) {
    const allowedList = Array.from(allowedBypassHosts).join(", ");
    throw new Error(
      `OPS_CONSOLE_BYPASS_AUTH is enabled but request host "${requestHost || "(empty)"}" is not allowlisted. Allowed hosts: ${allowedList}.`,
    );
  }

  const bypassAuth = bypassRequested && !deployedRuntime && hostIsAllowlisted;

  if (!supabaseUrl || !supabaseKey) {
    if (deployedRuntime) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured for admin deployments.",
      );
    }

    if (bypassAuth) {
      return (
        <div className="flex min-h-screen flex-col gap-10 px-8 py-8">
          <AdminNav />
          <div className="pb-24">
            <CardGlass
              title="Bypass mode"
              subtitle="Supabase credentials missing; OPS_CONSOLE_BYPASS_AUTH enabled."
              className="max-w-xl"
            >
              <p className="text-sm text-white/70">
                Rendering admin surface with mocked data. Do not enable this in production deployments.
              </p>
            </CardGlass>
            {children}
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <CardGlass title="Configuration required" subtitle="Supabase URL and anon key missing in environment." className="max-w-md">
          <p>Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for admin preview deployments.</p>
        </CardGlass>
      </div>
    );
  }

  if (bypassAuth) {
    return (
      <div className="flex min-h-screen flex-col gap-10 px-8 py-8">
        <AdminNav />
        <div className="space-y-6 pb-24">
          <CardGlass
            title="Bypass mode"
            subtitle="OPS_CONSOLE_BYPASS_AUTH enabled — RBAC skipped for local testing."
            className="max-w-xl"
          >
            <p className="text-sm text-amber-100/80">
              Ensure this flag stays disabled outside local or CI environments. Requests still execute against edge functions.
            </p>
          </CardGlass>
          {children}
        </div>
      </div>
    );
  }

  const supabase = await createAdminServerClient();
  if (!supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <CardGlass title="Configuration required" subtitle="Supabase client unavailable." className="max-w-md">
          <p>Verify Supabase environment variables and retry.</p>
        </CardGlass>
      </div>
    );
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const metadataRoles = Array.isArray(session.user.app_metadata?.roles)
    ? (session.user.app_metadata?.roles as string[])
    : [];
  const userMetadataRoles = Array.isArray(session.user.user_metadata?.roles)
    ? (session.user.user_metadata?.roles as string[])
    : [];
  const dedupedRoles = new Set<string>(
    [...metadataRoles, ...userMetadataRoles].map((role) => role?.toLowerCase?.() ?? ""),
  );
  const hasRole = [...dedupedRoles].some((role) => allowedRoles.has(role));
  if (!hasRole) {
    redirect("/login?error=unauthorized");
  }

  return (
    <div className="flex min-h-screen flex-col gap-10 px-8 py-8">
      <AdminNav />
      <div className="pb-24">{children}</div>
    </div>
  );
}
