'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchFloorStatus } from '../../lib/api';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@icupa/ui';

const statusStyles: Record<string, string> = {
  open: 'border-white/20 bg-white/5 text-white',
  seated: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100',
  ordering: 'border-sky-400/40 bg-sky-400/15 text-sky-100',
  dining: 'border-amber-400/40 bg-amber-400/15 text-amber-100',
  'awaiting-runner': 'border-rose-400/40 bg-rose-500/15 text-rose-100',
  'needs-bus': 'border-rose-500/40 bg-rose-500/20 text-rose-100',
};

export default function FloorManagementPage() {
  const { data } = useQuery({ queryKey: ['vendor-floor'], queryFn: fetchFloorStatus });

  return (
    <main className="flex-1 bg-gradient-to-br from-slate-950 via-slate-900/80 to-emerald-900/60 text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge variant="outline" className="glass-surface border-white/20 bg-white/10 text-white">
              Floor orchestration
            </Badge>
            <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Assign staff and resolve flags</h1>
            <p className="mt-2 max-w-2xl text-lg text-white/80">
              Real-time table state keeps staff synced with guest expectations. Assign servers, call runners, and clear
              tables with one tap.
            </p>
          </div>
          <Button variant="outline" className="glass-surface border-white/20">
            Export floor report
          </Button>
        </div>

        <Card className="glass-surface border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle>Current floor map</CardTitle>
            <p className="text-white/70">Tap a table to request staff or update state.</p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data?.map((table) => (
              <button
                key={table.id}
                className={`space-y-2 rounded-2xl border p-4 text-left transition hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${statusStyles[table.status] ?? 'border-white/20 bg-white/5 text-white'}`}
                type="button"
              >
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold text-white">{table.label}</p>
                  <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
                    {table.guests ? `${table.guests} guests` : 'Open'}
                  </Badge>
                </div>
                <p className="text-sm text-white/70">{table.server ? `Server ${table.server}` : 'Unassigned'}</p>
                <p className="text-sm text-white/60">{table.sla === '—' ? 'No SLA' : `Next check ${table.sla}`}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
