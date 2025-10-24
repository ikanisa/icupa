import { CardGlass, buttonClassName } from "@ecotrips/ui";

import { MagicLinkForm } from "../components/MagicLinkForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16">
      <div className="w-full max-w-lg">
        <CardGlass
          title="ecoTrips Ops sign-in"
          subtitle="Ops and admin roles require Supabase-authenticated sessions."
          actions={
            <a href="/api/auth/signout" className={buttonClassName("glass")}>Sign out</a>
          }
        >
          <p className="text-sm text-slate-100/80">
            Approved operators receive a passwordless magic link. Role checks run against sec.user_roles inside Supabase with
            RLS enforced.
          </p>
          <MagicLinkForm redirectPath="/dashboard" />
        </CardGlass>
      </div>
    </div>
  );
}
