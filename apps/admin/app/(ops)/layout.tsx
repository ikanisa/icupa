import "../../styles/globals.css";
import "@ecotrips/ui/styles/tokens.css";

import { CardGlass } from "@ecotrips/ui";
import { createServerSupabaseClient, getSupabaseSession, resolveSupabaseConfig } from "@ecotrips/supabase";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminNav } from "./_components/AdminNav";

const allowedRoles = new Set(["ops", "admin"]);

type LayoutProps = {
  children: ReactNode;
};

export default async function OpsLayout({ children }: LayoutProps) {
  const cookieStore = cookies();
  const config = resolveSupabaseConfig();

  if (!config) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <CardGlass title="Configuration required" subtitle="Supabase URL and anon key missing in environment." className="max-w-md">
          <p>Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for admin preview deployments.</p>
        </CardGlass>
      </div>
    );
  }

  const supabase = createServerSupabaseClient({ cookies: () => cookieStore }, { config });
  const session = await getSupabaseSession(supabase);

  if (!session) {
    redirect("/login");
  }

  const { data: roles, error } = await supabase
    .from("sec.user_roles")
    .select("role")
    .eq("user_id", session.user.id);

  if (error) {
    console.error("Failed to load roles", { error });
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <CardGlass title="Access error" subtitle="We could not verify your role right now." className="max-w-md">
          <p>Please refresh or escalate to the duty manager while we restore connectivity.</p>
        </CardGlass>
      </div>
    );
  }

  const hasRole = roles?.some((row) => allowedRoles.has(row.role));
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
