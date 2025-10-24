'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchKdsBoard } from '../../lib/api';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@icupa/ui';

const statusToColor: Record<string, string> = {
  firing: 'border-amber-400/40 bg-amber-400/15 text-amber-100',
  plating: 'border-sky-400/40 bg-sky-400/15 text-sky-100',
  ready: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-100',
  queued: 'border-white/15 bg-white/5 text-white',
};

export default function KitchenDisplaySystemPage() {
  const { data } = useQuery({ queryKey: ['vendor-kds'], queryFn: fetchKdsBoard });

  return (
    <main className="flex-1 bg-gradient-to-br from-slate-950 via-slate-900/80 to-purple-900/60 text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge variant="outline" className="glass-surface border-white/20 bg-white/10 text-white">
              Kitchen display system
            </Badge>
            <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Lane overview</h1>
            <p className="mt-2 max-w-2xl text-lg text-white/80">
              Each lane stays synced with ICUPA orders and table sessions. Tickets show SLA countdowns and agent
              escalations in real time.
            </p>
          </div>
          <Button variant="outline" className="glass-surface border-white/20">
            Open runner view
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {data?.map((lane) => (
            <Card key={lane.id} className="glass-surface border-white/10 bg-white/5 text-white">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-2xl text-white">{lane.label}</CardTitle>
                  <p className="text-sm text-white/70">SLA target {lane.sla}</p>
                </div>
                <Badge className="glass-surface border-white/20 bg-white/10 text-sm text-white">
                  {lane.tickets.length} tickets
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {lane.tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`space-y-2 rounded-2xl border p-4 ${statusToColor[ticket.status] ?? 'border-white/15 bg-white/5 text-white'}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">{ticket.id}</p>
                      <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
                        {ticket.elapsed}
                      </Badge>
                    </div>
                    <p className="text-sm text-white/70">Table {ticket.table}</p>
                    <ul className="space-y-1 text-sm text-white/80">
                      {ticket.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
