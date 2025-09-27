"use client";

import { useEffect, useState } from "react";
import { Card } from "@icupa/ui/card";
import { Badge } from "@icupa/ui/badge";
import { Separator } from "@icupa/ui/separator";
import { supabase } from "@/lib/supabase-client";

interface FloorTableRow {
  id: string;
  code: string | null;
  seats: number | null;
  hasActiveSession: boolean;
}

export default function MerchantFloorPage() {
  const [tables, setTables] = useState<FloorTableRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("tables")
        .select("id, code, seats, table_sessions!left(id, expires_at)")
        .order("code", { ascending: true });
      if (error) console.error(error);
      if (!cancelled) {
        const rows = (data ?? []).map((row: any) => ({
          id: row.id,
          code: row.code,
          seats: row.seats,
          hasActiveSession: Array.isArray(row.table_sessions) && row.table_sessions.some((s: any) => new Date(s.expires_at ?? 0).getTime() > Date.now())
        })) as FloorTableRow[];
        setTables(rows);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8 text-white">
      <header>
        <h1 className="text-2xl font-semibold">Floor Overview</h1>
        <p className="text-sm text-white/70">Active sessions and seating capacity.</p>
      </header>
      <Separator className="bg-white/10" />
      {loading ? (
        <p className="text-sm text-white/70">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {tables.map((t) => (
            <Card key={t.id} className="glass-card border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Table {t.code ?? t.id.slice(0, 4)}</p>
                  <p className="text-xs text-white/70">{t.seats ?? 0} seats</p>
                </div>
                <Badge variant={t.hasActiveSession ? "default" : "outline"}>
                  {t.hasActiveSession ? "Occupied" : "Available"}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

