"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import type { ReactNode } from "react";
import { clsx } from "clsx";

export type BottomNavItem = {
  label: string;
  href: Route;
  icon: ReactNode;
};

type BottomNavDockProps = {
  items: readonly BottomNavItem[];
};

export function BottomNavDock({ items }: BottomNavDockProps) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-3xl border border-white/10 bg-slate-900/80 p-2 backdrop-blur">
      <ul className="flex items-center justify-between">
        {items.map((item) => {
          const href = item.href as unknown as string;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={item.href}
                className={clsx(
                  "flex flex-col items-center gap-1 rounded-2xl px-4 py-2 text-xs font-medium transition-all",
                  active
                    ? "bg-white/15 text-sky-200 shadow-inner shadow-sky-500/40"
                    : "text-slate-200/80 hover:text-slate-100",
                )}
              >
                <span aria-hidden>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
