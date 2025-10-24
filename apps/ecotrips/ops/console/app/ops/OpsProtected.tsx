import type { ReactNode } from "react";
import { verifyOpsAccess } from "../../lib/auth";

export default async function OpsProtected({
  children,
}: {
  children: ReactNode;
}) {
  const access = await verifyOpsAccess();

  if (!access.ok) {
    return (
      <section className="p-6">
        <h1 className="text-xl font-semibold">Access Restricted</h1>
        <p className="mt-2">{access.message}</p>
        <p className="mt-2">
          Ensure you are signed in with an operator account (
          <code>persona = &quot;ops&quot;</code>) and that required environment
          variables are configured.
        </p>
      </section>
    );
  }

  return <>{children}</>;
}

