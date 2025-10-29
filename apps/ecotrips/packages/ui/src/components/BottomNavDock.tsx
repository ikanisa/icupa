"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { clsx } from "clsx";

export type BottomNavItem = {
  label: string;
  href: Route | string;
  icon: ReactNode;
};

type BottomNavDockProps = {
  items: readonly BottomNavItem[];
  activePath?: string;
};

export function BottomNavDock({ items, activePath }: BottomNavDockProps) {
  const hookPath = usePathname();
  const pathname = activePath ?? hookPath ?? "";
  return (
    <nav className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-3xl border border-glass-border bg-surface/80 p-2 text-surface-foreground backdrop-blur-glass">
      <ul className="flex items-center justify-between">
        {items.map((item) => {
          const href = item.href as string;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <NextLink
                href={item.href as never}
                className={clsx(
                  "flex flex-col items-center gap-1 rounded-2xl px-4 py-2 text-xs font-medium transition-all duration-[var(--eco-duration-base)] ease-[var(--eco-easing-std)]",
                  active
                    ? "bg-brand/20 text-brand shadow-inner"
                    : "text-muted hover:text-surface-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <span aria-hidden>{item.icon}</span>
                <span>{item.label}</span>
              </NextLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
