import { useEffect, useState } from "react";
import { Activity, ShieldCheck } from "lucide-react";
import { Badge } from "@icupa/ui/badge";
import { Button } from "@icupa/ui/button";
import { Card } from "@icupa/ui/card";
import { Input } from "@icupa/ui/input";
import { Label } from "@icupa/ui/label";
import { Progress } from "@icupa/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@icupa/ui/select";
import { Switch } from "@icupa/ui/switch";
import { Skeleton } from "@icupa/ui/skeleton";
import type { MerchantLocation } from "@/hooks/useMerchantLocations";
import { useInventoryControls, type InventoryRecord } from "@/hooks/useInventoryControls";

interface InventoryManagerPanelProps {
  location: MerchantLocation | null;
}

export function InventoryManagerPanel({ location }: InventoryManagerPanelProps) {
  const { records, isLoading, updateInventory } = useInventoryControls(location ?? undefined);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Inventory automation</h2>
          <p className="text-sm text-muted-foreground">
            Track par levels, trigger auto-86 when stock dips, and keep the AI waiter honest.
          </p>
        </div>
        <Badge variant="outline" className="border-white/10 bg-white/10 text-xs text-white/80">
          <ShieldCheck className="mr-2 h-4 w-4" /> Autonomy ≤ L2
        </Badge>
      </header>

      <Card className="glass-card p-6">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {records.map((record) => (
              <InventoryRow key={record.id} record={record} onSave={updateInventory.mutate} saving={updateInventory.isPending} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

interface InventoryRowProps {
  record: InventoryRecord;
  saving: boolean;
  onSave: (input: {
    id: string;
    quantity: number;
    reorderThreshold: number;
    auto86: boolean;
    auto86Level: InventoryRecord["auto86Level"];
  }) => void;
}

function InventoryRow({ record, onSave, saving }: InventoryRowProps) {
  const [quantity, setQuantity] = useState(record.quantity);
  const [threshold, setThreshold] = useState(record.reorderThreshold);
  const [auto86, setAuto86] = useState(record.auto86);
  const [autoLevel, setAutoLevel] = useState<InventoryRecord["auto86Level"]>(record.auto86Level);

  useEffect(() => {
    setQuantity(record.quantity);
    setThreshold(record.reorderThreshold);
    setAuto86(record.auto86);
    setAutoLevel(record.auto86Level);
  }, [record]);

  const progress = record.parLevel > 0 ? Math.min(100, Math.round((record.quantity / record.parLevel) * 100)) : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold">
        <div>
          <p>{record.displayName}</p>
          <p className="text-xs text-white/60">SKU {record.sku}</p>
        </div>
        <Badge variant="outline" className="border-white/10 bg-white/10 text-xs text-white/70">
          Updated {record.updatedAt ? new Date(record.updatedAt).toLocaleTimeString() : "just now"}
        </Badge>
      </div>

      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor={`quantity-${record.id}`}>On hand</Label>
          <Input
            id={`quantity-${record.id}`}
            type="number"
            value={quantity}
            min={0}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className="glass-card border-white/10 bg-transparent"
          />
        </div>
        <div className="flex-1 space-y-2">
          <Label htmlFor={`threshold-${record.id}`}>Auto-86 threshold</Label>
          <Input
            id={`threshold-${record.id}`}
            type="number"
            value={threshold}
            min={0}
            onChange={(event) => setThreshold(Number(event.target.value))}
            className="glass-card border-white/10 bg-transparent"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-xs text-white/80">Auto-86</Label>
          <div className="flex items-center gap-3 text-xs text-white/70">
            <Switch checked={auto86} onCheckedChange={setAuto86} />
            <span>{auto86 ? "Enabled" : "Disabled"}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-xs text-white/80">Autonomy level</Label>
          <Select value={autoLevel} onValueChange={(value) => setAutoLevel(value as InventoryRecord["auto86Level"])}>
            <SelectTrigger className="glass-card w-[120px] border-white/10 bg-transparent text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="L0">L0 — suggest only</SelectItem>
              <SelectItem value="L1">L1 — one tap approve</SelectItem>
              <SelectItem value="L2">L2 — auto hide</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          className="self-start"
          onClick={() =>
            onSave({ id: record.id, quantity, reorderThreshold: threshold, auto86, auto86Level: autoLevel })
          }
          disabled={saving}
        >
          Save
        </Button>
      </div>

      <div className="mt-4 space-y-2 text-xs text-white/70">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" /> Utilisation vs par
          </span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="h-2 bg-white/20" />
      </div>
    </div>
  );
}
