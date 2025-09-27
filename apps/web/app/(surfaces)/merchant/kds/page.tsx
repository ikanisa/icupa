"use client";

import { useEffect, useState } from "react";
import { Card } from "@icupa/ui/card";
import { Badge } from "@icupa/ui/badge";
import { Separator } from "@icupa/ui/separator";
import { supabase } from "@/lib/supabase-client";

interface KdsOrderItem { name: string | null; quantity: number | null }
interface KdsOrderRow {
  id: string;
  status: string | null;
  created_at: string | null;
  items: KdsOrderItem[];
}

export default function MerchantKdsPage() {
  const [orders, setOrders] = useState<KdsOrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, created_at, order_items(quantity, items(name))")
        .in("status", ["submitted", "prepping"]) // ready orders are hidden by default here
        .order("created_at", { ascending: true })
        .limit(25);
      if (error) {
        console.error(error);
      }
      if (!cancelled) {
        const mapped = (data ?? []).map((row: any) => ({
          id: row.id,
          status: row.status,
          created_at: row.created_at,
          items: (row.order_items ?? []).map((oi: any) => ({ name: oi.items?.name ?? null, quantity: oi.quantity }))
        })) as KdsOrderRow[];
        setOrders(mapped);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8 text-white">
      <header>
        <h1 className="text-2xl font-semibold">Kitchen Display</h1>
        <p className="text-sm text-white/70">Incoming orders in FIFO order.</p>
      </header>
      <Separator className="bg-white/10" />
      {loading ? (
        <p className="text-sm text-white/70">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-white/70">No pending orders.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => (
            <Card key={order.id} className="glass-card border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest text-white/60">#{order.id.slice(0, 8)}</span>
                <Badge variant="outline" className="text-xs text-white/80">
                  {order.status}
                </Badge>
              </div>
              <ul className="space-y-1 text-sm">
                {order.items.map((it, idx) => (
                  <li key={idx} className="flex items-center justify-between">
                    <span className="text-white/90">{it.name ?? "Item"}</span>
                    <span className="text-white/70">× {it.quantity ?? 1}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

