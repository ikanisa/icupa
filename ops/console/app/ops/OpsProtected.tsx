import type { ReactNode } from "react";
import { verifyOpsAccess } from "../../lib/auth";

export default async function OpsProtected({
  children
}: {
  children: ReactNode;
}) {
  const access = await verifyOpsAccess();

  if (!access.ok) {
    return (
      <section>
        <h1>Access Restricted</h1>
        <p>{access.message}</p>
        <p>
          Ensure you are signed in with an operator account (`persona = "ops"`) and
          that required environment variables are configured.
        </p>
      </section>
    );
  }

  return (
    <>
      {access.bypassed ? (
        <aside role="status" style={{
          marginBottom: "1rem",
          padding: "0.75rem 1rem",
          borderRadius: "8px",
          border: "1px solid rgba(148, 163, 184, 0.4)",
          background: "rgba(15, 23, 42, 0.35)",
        }}>
          Offline bypass active — Supabase auth checks skipped for this session.
        </aside>
      ) : null}
      {children}
    </>
  );
}
