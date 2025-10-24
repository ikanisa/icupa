'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOrders } from '../../lib/api';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@icupa/ui';
import { formatDistanceToNow } from 'date-fns';

const states = [
  { id: 'all', label: 'All states' },
  { id: 'prepping', label: 'Prepping' },
  { id: 'ready', label: 'Ready' },
  { id: 'awaiting-payment', label: 'Awaiting payment' },
];

type OrderState = (typeof states)[number]['id'];

export default function OrdersPage() {
  const [stateFilter, setStateFilter] = useState<OrderState>('all');
  const [search, setSearch] = useState('');

  const { data } = useQuery({ queryKey: ['vendor-orders'], queryFn: fetchOrders });

  const filteredOrders = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.filter((order) => {
      const matchesState = stateFilter === 'all' || order.state === stateFilter;
      const matchesSearch = search
        ? [order.id, order.table, order.guestName].some((value) => value.toLowerCase().includes(search.toLowerCase()))
        : true;
      return matchesState && matchesSearch;
    });
  }, [data, search, stateFilter]);

  return (
    <main className="flex-1 bg-gradient-to-br from-slate-950 via-slate-900/80 to-indigo-900/60 text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge variant="outline" className="glass-surface border-white/20 bg-white/10 text-white">
              Order board
            </Badge>
            <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Manage live orders</h1>
            <p className="mt-2 max-w-2xl text-lg text-white/80">
              Filter by state, trigger receipts, and send reprints. All updates sync instantly with diners and ICUPA
              agents.
            </p>
          </div>
          <Button variant="outline" className="glass-surface border-white/20">
            Download receipt batch
          </Button>
        </div>

        <Card className="glass-surface border-white/10 bg-white/5 text-white">
          <CardHeader className="gap-6 md:flex md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle>Orders</CardTitle>
              <CardDescription className="text-white/70">
                {filteredOrders.length} of {data?.length ?? 0} orders shown
              </CardDescription>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                placeholder="Search by order, guest, or table"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="bg-white/10 text-white placeholder:text-white/40"
              />
              <Select value={stateFilter} onValueChange={(value) => setStateFilter(value as OrderState)}>
                <SelectTrigger className="w-[200px] border-white/20 bg-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-slate-900 text-white">
                  {states.map((state) => (
                    <SelectItem key={state.id} value={state.id}>
                      {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full table-auto border-collapse text-left">
              <thead className="text-sm uppercase tracking-[0.25em] text-white/60">
                <tr>
                  <th className="pb-4 pr-4">Order</th>
                  <th className="pb-4 pr-4">Table</th>
                  <th className="pb-4 pr-4">Guest</th>
                  <th className="pb-4 pr-4">Total</th>
                  <th className="pb-4 pr-4">Placed</th>
                  <th className="pb-4 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-sm">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="transition hover:bg-white/5">
                    <td className="py-3 pr-4 font-medium text-white">{order.id}</td>
                    <td className="py-3 pr-4 text-white/80">{order.table}</td>
                    <td className="py-3 pr-4 text-white/80">{order.guestName}</td>
                    <td className="py-3 pr-4 text-white/80">${order.total.toFixed(2)}</td>
                    <td className="py-3 pr-4 text-white/80">
                      {formatDistanceToNow(new Date(order.placedAt), { addSuffix: true })}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="border-white/20 text-white">
                          Mark ready
                        </Button>
                        <Button size="sm" className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400">
                          Issue receipt
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
