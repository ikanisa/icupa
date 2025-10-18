import { CardGlass, buttonClassName } from "@ecotrips/ui";

import { MagicLinkForm } from "../components/MagicLinkForm";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-4 py-16">
      <CardGlass
        title="Sign in"
        subtitle="Secure login powered by Supabase Auth."
        actions={
          <a href="/api/auth/signout" className={buttonClassName("glass")}>Sign out</a>
        }
      >
        <p className="text-sm text-white/80">
          We support passwordless magic links and social logins. Role-based access (consumer, supplier, ops, admin) is stored in
          sec.user_roles with RLS enforcement.
        </p>
        <MagicLinkForm redirectPath="/" title="Check your inbox" />
      </CardGlass>
    </div>
  );
}
