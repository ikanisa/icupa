"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/ops/manifests", label: "Manifests", description: "Departures, travelers, supplier signals" },
  { href: "/ops/exceptions", label: "Exceptions", description: "Flight alerts, escalations, holds" },
  { href: "/ops/refunds", label: "Refunds", description: "Ledger adjustments & customer outcomes" },
  { href: "/ops/supplier-slas", label: "Supplier SLAs", description: "Performance against contracted response times" },
];

export function OpsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Operator console" className="ops-nav">
      <ul className="flex flex-col gap-1">
        {NAV_LINKS.map((link) => {
          const isActive = pathname?.startsWith(link.href) ?? false;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`group flex flex-col rounded-2xl border px-4 py-3 transition ${
                  isActive
                    ? "border-emerald-400/60 bg-emerald-400/10"
                    : "border-slate-800/60 hover:border-emerald-300/50 hover:bg-slate-900"
                }`}
              >
                <span className="text-sm font-semibold text-white">
                  {link.label}
                  {isActive ? (
                    <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-200">
                      Viewing
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-slate-400">{link.description}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
