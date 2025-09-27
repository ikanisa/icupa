import { memo } from "react";
import { AlarmClock, Check, CookingPot, Loader2, TimerReset } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrepDuration, useKdsOrders, type KdsOrder, type OrderStatus } from "@/hooks/useKdsOrders";
import type { MerchantLocation } from "@/hooks/useMerchantLocations";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<OrderStatus, string> = {
  submitted: "Queued",
  in_kitchen: "In Kitchen",
  ready: "Ready",
  served: "Served",
  settled: "Settled",
  voided: "Voided",
};

const STATUS_TONE: Record<OrderStatus, string> = {
  submitted: "bg-amber-500/20 text-amber-200",
  in_kitchen: "bg-indigo-500/20 text-indigo-200",
  ready: "bg-emerald-500/20 text-emerald-200",
  served: "bg-sky-500/20 text-sky-200",
  settled: "bg-emerald-500/20 text-emerald-200",
  voided: "bg-rose-500/20 text-rose-200",
};

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  submitted: "in_kitchen",
  in_kitchen: "ready",
  ready: "served",
};

const ALERT_THRESHOLD_SECONDS = 12 * 60; // escalate after 12 minutes

interface KDSBoardProps {
  location: MerchantLocation | null;
}

export const KDSBoard = memo(({ location }: KDSBoardProps) => {
  const { orders, isLoading, markOrderStatus } = useKdsOrders(location ?? null);

  return (
    <div className="grid gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Kitchen Display</h2>
          <p className="text-sm text-muted-foreground">
            Orders update in real time. Escalations trigger after 12 minutes in queue.
          </p>
        </div>
        <Badge variant="outline" className="glass-card border-white/10 bg-white/10 text-sm">
          <TimerReset className="mr-2 h-4 w-4" /> Fresh feed
        </Badge>
      </header>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Card key={idx} className="glass-card p-6">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="mt-4 h-4 w-32" />
              <Skeleton className="mt-6 h-16" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orders.length === 0 && (
            <Card className="glass-card p-8 text-center text-sm text-muted-foreground">
              No active orders for {location?.name ?? "this venue"}. The board will light up as soon as guests submit.
            </Card>
          )}
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} onAdvance={markOrderStatus} />
          ))}
        </div>
      )}
    </div>
  );
});
KDSBoard.displayName = "KDSBoard";

interface OrderCardProps {
  order: KdsOrder;
  onAdvance: (order: KdsOrder, nextStatus: OrderStatus) => Promise<void>;
}

const OrderCard = memo(({ order, onAdvance }: OrderCardProps) => {
  const nextStatus = NEXT_STATUS[order.status];
  const overdue = order.prepSeconds >= ALERT_THRESHOLD_SECONDS;

  return (
    <Card className={cn("glass-card flex h-full flex-col p-6", overdue && "ring-2 ring-rose-400/70")}> 
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs uppercase text-muted-foreground">Table</span>
          <p className="text-2xl font-semibold">{order.tableCode}</p>
        </div>
        <Badge className={cn("px-3 py-1 text-xs", STATUS_TONE[order.status])}>{STATUS_LABEL[order.status]}</Badge>
      </div>

      <Separator className="my-4 bg-white/10" />

      <ul className="space-y-2 text-sm">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between">
            <span className="font-medium text-foreground">{item.name}</span>
            <span className="text-muted-foreground">×{item.quantity}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-between text-sm">
        <span className={cn("flex items-center gap-2 font-medium", overdue ? "text-rose-200" : "text-emerald-200")}> 
          <AlarmClock className="h-4 w-4" />
          {formatPrepDuration(order.prepSeconds)} elapsed
        </span>
        {overdue ? (
          <Badge variant="destructive" className="px-2 py-1 text-[11px]">
            Behind target
          </Badge>
        ) : (
          <Badge variant="outline" className="border-white/10 px-2 py-1 text-[11px] text-white/70">
            {order.items.length} items
          </Badge>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3">
        {nextStatus ? (
          <Button
            className="flex-1"
            onClick={() => onAdvance(order, nextStatus)}
            variant={order.status === "ready" ? "secondary" : "default"}
          >
            {order.status === "submitted" && (
              <CookingPot className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {order.status === "in_kitchen" && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {order.status === "ready" && <Check className="mr-2 h-4 w-4" aria-hidden="true" />}
            Advance to {STATUS_LABEL[nextStatus]}
          </Button>
        ) : (
          <Button className="flex-1" variant="secondary" disabled>
            {order.status === "served" ? "Awaiting payment" : "Complete"}
          </Button>
        )}
      </div>
    </Card>
  );
});
OrderCard.displayName = "OrderCard";
