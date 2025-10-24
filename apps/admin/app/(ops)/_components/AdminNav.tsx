"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Button } from "@ecotrips/ui";

const tabs = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/bookings", label: "Bookings" },
  { href: "/groups-escrows", label: "Groups & Escrows" },
  { href: "/permits", label: "Permits" },
  { href: "/finance", label: "Finance" },
  { href: "/exceptions", label: "Exceptions" },
  { href: "/affiliate/logs", label: "Affiliate" },
  { href: "/whatsapp", label: "WhatsApp" },
  { href: "/translations", label: "Translations" },
  { href: "/privacy", label: "Privacy/GDPR" },
  { href: "/dr", label: "DR & Backups" },
  { href: "/performance", label: "Performance" },
  { href: "/settings", label: "Settings" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  const handleRefresh = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      const response = await fetch("/api/auth/signout", { method: "POST" });
      if (!response.ok) {
        console.error("signout_failed", { status: response.status });
      }
    } catch (error) {
      console.error("signout_error", error);
    } finally {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  };

  return (
    <header className="sticky top-4 z-50 flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/80 p-6 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-300/80">ecoTrips Ops Console</p>
          <h1 className="text-2xl font-semibold text-white">Morning Ops Sweep</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="glass" onClick={handleRefresh}>Refresh data</Button>
          <Button variant="secondary" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </div>
      <nav className="overflow-x-auto">
        <ul className="flex min-w-full gap-2">
          {tabs.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className={clsx(
                    "whitespace-nowrap rounded-full px-4 py-2 text-sm transition-all",
                    active ? "bg-white/15 text-sky-200" : "text-slate-200/70 hover:text-slate-100",
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
