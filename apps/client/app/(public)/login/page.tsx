import { CardGlass, buttonClassName } from "@ecotrips/ui";

import { createPageMetadata } from "../../../lib/seo/metadata";
import { PublicPage } from "../components/PublicPage";
import { MagicLinkForm } from "../components/MagicLinkForm";

export const metadata = createPageMetadata({
  title: "Login",
  description: "Sign in with Supabase Auth magic links or federated providers.",
  path: "/login",
});

export default function LoginPage() {
  return (
    <PublicPage align="center" maxWidthClass="max-w-lg">
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
    </PublicPage>
  );
}
