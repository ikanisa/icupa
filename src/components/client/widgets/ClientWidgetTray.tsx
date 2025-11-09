import { useMemo } from "react";
import { Card } from "@icupa/ui/card";
import { Badge } from "@icupa/ui/badge";
import { Progress } from "@icupa/ui/progress";
import { Sparkles, Wifi, WifiOff, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

interface ClientWidgetTrayProps {
  currency: string;
  locale: string;
  subtotalCents: number;
  tipCents: number;
  itemCount: number;
  isOnline: boolean;
  offlineSinceLabel: string | null;
  tableSessionLabel: string;
  realtimeStatus: "connected" | "connecting" | "idle";
}

export function ClientWidgetTray({
  currency,
  locale,
  subtotalCents,
  tipCents,
  itemCount,
  isOnline,
  offlineSinceLabel,
  tableSessionLabel,
  realtimeStatus,
}: ClientWidgetTrayProps) {
  const totalValue = subtotalCents + tipCents;
  const orderProgress = useMemo(() => {
    const clamped = Math.min(100, itemCount * 20);
    return clamped;
  }, [itemCount]);

  return (
    <div className="grid gap-4 py-4 md:grid-cols-3">
      <Card className="glass-card border border-white/10 bg-white/10 p-4 text-white">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.3em] text-white/60">Order readiness</span>
          <Badge className="bg-white/10 text-white/80" variant="outline">
            {itemCount} items
          </Badge>
        </div>
        <p className="mt-2 text-2xl font-semibold">{formatCurrency(totalValue, currency, locale)}</p>
        <p className="text-xs text-white/60">
          Subtotal {formatCurrency(subtotalCents, currency, locale)} • Tip {formatCurrency(tipCents, currency, locale)}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={orderProgress} className="flex-1 bg-white/20" />
          <span className="text-xs text-white/60">{orderProgress}%</span>
        </div>
      </Card>

      <Card className="glass-card border border-white/10 bg-white/10 p-4 text-white">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.3em] text-white/60">Connectivity</span>
          {isOnline ? <Wifi className="h-4 w-4 text-emerald-300" /> : <WifiOff className="h-4 w-4 text-red-300" />}
        </div>
        <p className="mt-2 text-2xl font-semibold">{isOnline ? "Online" : "Offline"}</p>
        <p className="text-xs text-white/60">
          {isOnline ? "Realtime updates are flowing." : offlineSinceLabel ? `Offline since ${offlineSinceLabel}` : "Offline"}
        </p>
        <div className="mt-3 flex items-center gap-3 text-xs text-white/60">
          <Clock className="h-4 w-4" />
          <span>{tableSessionLabel}</span>
        </div>
      </Card>

      <Card className="glass-card border border-white/10 bg-white/10 p-4 text-white">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.3em] text-white/60">Agent presence</span>
          <Sparkles className="h-4 w-4 text-sky-300" />
        </div>
        <p className="mt-2 text-2xl font-semibold capitalize">{realtimeStatus}</p>
        <p className="text-xs text-white/60">
          {realtimeStatus === "connected"
            ? "Voice + chat waiter ready for handoffs."
            : realtimeStatus === "connecting"
              ? "Negotiating realtime session with Supabase."
              : "Waiting for the first interaction to start a realtime session."}
        </p>
      </Card>
    </div>
  );
}
