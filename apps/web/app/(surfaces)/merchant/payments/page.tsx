"use client";

import { useEffect, useState } from "react";
import { Card } from "@icupa/ui/card";
import { Badge } from "@icupa/ui/badge";
import { Separator } from "@icupa/ui/separator";
import { supabase } from "@/lib/supabase-client";

interface PaymentRow {
  id: string;
  orderId: string;
  method: string | null;
  status: string | null;
  amountCents: number | null;
  providerRef: string | null;
}

export default function MerchantPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, order_id, method, status, amount_cents, provider_ref")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        console.error(error);
      }
      if (!cancelled) {
        const rows = (data ?? []).map((row: any) => ({
          id: row.id,
          orderId: row.order_id,
          method: row.method,
          status: row.status,
          amountCents: row.amount_cents,
          providerRef: row.provider_ref ?? null,
        })) as PaymentRow[];
        setPayments(rows);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8 text-white">
      <header>
        <h1 className="text-2xl font-semibold">Payments Console</h1>
        <p className="text-sm text-white/70">Recent payments and statuses.</p>
      </header>
      <Separator className="bg-white/10" />
      {loading ? (
        <p className="text-sm text-white/70">Loading…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {payments.map((p) => (
            <Card key={p.id} className="glass-card border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest text-white/60">#{p.id.slice(0, 8)}</span>
                <Badge variant={p.status === 'captured' ? 'default' : p.status === 'failed' ? 'destructive' : 'outline'}>{p.status}</Badge>
              </div>
              <p className="text-sm text-white/80">Order: {p.orderId.slice(0, 8)}</p>
              <p className="text-sm text-white/70">Method: {p.method ?? '—'}</p>
              <p className="text-sm text-white/70">Amount: {typeof p.amountCents === 'number' ? (p.amountCents / 100).toFixed(2) : '—'}</p>
              <p className="truncate text-xs text-white/50">Ref: {p.providerRef ?? '—'}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

