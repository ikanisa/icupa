'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchInventory } from '../../lib/api';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
} from '@icupa/ui';

export default function InventoryPage() {
  const { data } = useQuery({ queryKey: ['vendor-inventory'], queryFn: fetchInventory });

  return (
    <main className="flex-1 bg-gradient-to-br from-slate-950 via-slate-900/80 to-lime-900/60 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge variant="outline" className="glass-surface border-white/20 bg-white/10 text-white">
              Inventory intelligence
            </Badge>
            <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Stock levels & auto-86</h1>
            <p className="mt-2 max-w-3xl text-lg text-white/80">
              ICUPA agents monitor on-hand counts and automatically pause items when thresholds hit. Adjust overrides here.
            </p>
          </div>
          <Button variant="outline" className="glass-surface border-white/20">
            Sync with POS
          </Button>
        </div>

        <Card className="glass-surface border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle>Live inventory</CardTitle>
            <CardDescription className="text-white/70">
              Toggle auto-86 by item. Agents respect your policies when pausing upsells or menu availability.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data?.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl border border-white/15 bg-white/5 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-lg font-semibold text-white">{item.item}</p>
                  <p className="text-sm text-white/70">
                    {item.onHand} {item.unit} on hand • Restock {item.restockEtaMinutes ? `${item.restockEtaMinutes} min` : 'Ready'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-white/70">Auto-86</p>
                  <Switch checked={item.auto86} aria-label={`Toggle auto 86 for ${item.item}`} />
                  <Button size="sm" variant="outline" className="border-white/20 text-white">
                    Adjust threshold
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
