'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Badge, Button, ScrollArea, Separator } from '@icupa/ui';
import { ShieldCheck, BarChart3, Users, Bot, Flag, Menu, UserCircle2, type LucideIcon } from 'lucide-react';
import { APP_DEFINITIONS } from '@icupa/types/apps';
import { cn } from '@icupa/ui';
import { useAdminSession } from './session-context';
import { getSupabaseBrowserClient } from '../../lib/supabase-browser';

const navItems = [
  {
    label: 'Overview',
    href: '/' as Route,
    icon: ShieldCheck,
    description: 'Mission control for governance.',
  },
  {
    label: 'Tenants',
    href: '/tenants' as Route,
    icon: Users,
    description: 'Lifecycle, KYB, and onboarding.',
  },
  {
    label: 'AI Settings',
    href: '/ai' as Route,
    icon: Bot,
    description: 'Agent autonomy, tools, budgets.',
  },
  {
    label: 'Analytics',
    href: '/analytics' as Route,
    icon: BarChart3,
    description: 'GMV, SLA, and AI adoption.',
  },
  {
    label: 'Compliance',
    href: '/compliance' as Route,
    icon: ShieldCheck,
    description: 'Fiscal coverage and incidents.',
  },
  {
    label: 'Flags',
    href: '/flags' as Route,
    icon: Flag,
    description: 'Rollouts and kill-switches.',
  },
  {
    label: 'Account',
    href: '/account' as Route,
    icon: UserCircle2,
    description: 'Session details and sign out.',
  },
] satisfies Array<{ label: string; href: Route; icon: LucideIcon; description: string }>;

export function ConsoleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const adminApp = APP_DEFINITIONS.admin;
  const { user } = useAdminSession();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-[300px] border-r border-white/10 bg-slate-950/70 backdrop-blur-xl md:block">
        <div className="flex flex-col gap-6 p-6">
          <div className="space-y-3">
            <Badge variant="outline" className="glass-surface border-white/20 bg-white/5 text-white">
              {adminApp.tagline}
            </Badge>
            <h1 className="text-2xl font-semibold text-white">{adminApp.title}</h1>
            <p className="text-sm text-white/70">{adminApp.description}</p>
          </div>
          <Separator className="bg-white/10" />
          <ScrollArea className="h-[calc(100vh-14rem)] pr-2">
            <nav className="flex flex-col gap-2" aria-label="Admin navigation">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group flex flex-col gap-1 rounded-xl border border-transparent px-4 py-3 transition-colors',
                      isActive
                        ? 'border-white/20 bg-white/10 text-white shadow-lg'
                        : 'text-white/70 hover:border-white/10 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <item.icon className="h-4 w-4" aria-hidden />
                      {item.label}
                    </div>
                    <p className="text-xs text-white/60">{item.description}</p>
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>
        </div>
      </aside>
      <div className="flex w-full flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/10 bg-slate-950/60 px-6 py-4 backdrop-blur md:px-10">
          <div className="flex items-center gap-3 text-sm text-white/70">
            <Menu className="h-4 w-4 md:hidden" aria-hidden />
            <span className="hidden text-white md:inline">ICUPA Admin Control Plane</span>
            <span className="text-xs uppercase tracking-wide text-emerald-300/90">Beta</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-white/80">
            <span className="hidden truncate text-xs uppercase tracking-wide text-white/50 sm:block">{user.email}</span>
            <Button size="sm" variant="outline" className="glass-surface border-white/20 text-white" onClick={handleSignOut}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-10 md:py-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
