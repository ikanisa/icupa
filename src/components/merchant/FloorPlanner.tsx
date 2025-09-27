import { useCallback, useMemo, useRef, useState } from "react";
import { GripHorizontal, MapPin, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { TABLE_STATE_OPTIONS, useFloorTables, type TableState } from "@/hooks/useFloorTables";
import type { MerchantLocation } from "@/hooks/useMerchantLocations";
import { cn } from "@/lib/utils";

interface FloorPlannerProps {
  location: MerchantLocation | null;
  autoSyncFromKitchen?: boolean;
}

export function FloorPlanner({ location, autoSyncFromKitchen = true }: FloorPlannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [manualSync, setManualSync] = useState(!autoSyncFromKitchen);
  const { tables, isLoading, isSavingLayout, updateLayout, updateTableState } = useFloorTables(location ?? null);

  const handleDragStart = useCallback((id: string) => setDraggingId(id), []);

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (!draggingId || !containerRef.current) {
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      const layout = tables.find((table) => table.id === draggingId)?.layout ?? {
        x: 0,
        y: 0,
        width: 160,
        height: 160,
      };
      await updateLayout(draggingId, {
        ...layout,
        x: Math.max(0, Math.round(offsetX - layout.width / 2)),
        y: Math.max(0, Math.round(offsetY - layout.height / 2)),
      });
      setDraggingId(null);
    },
    [draggingId, tables, updateLayout]
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const activeTables = useMemo(() => [...tables].sort((a, b) => a.code.localeCompare(b.code)), [tables]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Floor orchestration</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Drag tables to rearrange your room and update states as service flows. Changes persist instantly for all staff devices.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="manual-sync"
            checked={manualSync}
            onCheckedChange={setManualSync}
            className="data-[state=checked]:bg-emerald-500"
          />
          <Label htmlFor="manual-sync" className="text-sm text-white/80">
            Manual overrides (disable to follow kitchen automation)
          </Label>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="glass-card relative h-[420px] overflow-hidden">
          <div
            ref={containerRef}
            className="relative h-full w-full cursor-move select-none"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {isLoading ? (
              <Skeleton className="absolute inset-4 h-[85%]" />
            ) : (
              activeTables.map((table) => (
                <button
                  key={table.id}
                  draggable
                  onDragStart={() => handleDragStart(table.id)}
                  className={cn(
                    "absolute flex h-[120px] w-[140px] flex-col justify-between rounded-2xl border border-white/10 bg-white/15 p-4 text-left shadow-lg transition", 
                    draggingId === table.id && "ring-2 ring-primary"
                  )}
                  style={{ transform: `translate(${table.layout.x}px, ${table.layout.y}px)` }}
                >
                  <div className="flex items-center justify-between text-xs font-medium text-white/80">
                    <span className="flex items-center gap-1">
                      <GripHorizontal className="h-3 w-3" /> {table.code}
                    </span>
                    <Badge variant="outline" className="border-white/20 text-[11px] text-white/80">
                      {TABLE_STATE_OPTIONS.find((option) => option.value === table.state)?.label ?? table.state}
                    </Badge>
                  </div>
                  <div className="mt-auto text-xs text-white/60">{table.seats ?? 2} seats</div>
                </button>
              ))
            )}
            {isSavingLayout && (
              <div className="pointer-events-none absolute bottom-4 right-4 rounded-full bg-white/20 px-4 py-1 text-xs font-medium text-white">
                Saving layout…
              </div>
            )}
          </div>
        </Card>

        <Card className="glass-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Live tables</h3>
            <Badge variant="outline" className="border-white/10 bg-white/5 text-xs text-white/70">
              <MapPin className="mr-1 h-3 w-3" /> {activeTables.length} active
            </Badge>
          </div>
          <div className="mt-4 space-y-4">
            {isLoading
              ? Array.from({ length: 4 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-20 w-full" />
                ))
              : activeTables.map((table) => (
                  <div
                    key={table.id}
                    className="rounded-2xl border border-white/5 bg-white/5 p-4 transition hover:border-primary/40"
                  >
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>Table {table.code}</span>
                      <Badge className="bg-primary/20 text-primary-foreground">
                        {TABLE_STATE_OPTIONS.find((option) => option.value === table.state)?.label ?? table.state}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs text-white/70">
                      <Sparkles className="h-3.5 w-3.5" />
                      {manualSync
                        ? "Manual updates enabled"
                        : "Syncing with kitchen and payments status"}
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <Select
                        value={table.state}
                        onValueChange={(value) => {
                          if (!manualSync) return;
                          updateTableState(table.id, value as TableState);
                        }}
                      >
                        <SelectTrigger
                          disabled={!manualSync}
                          className="glass-card border-white/10 bg-transparent text-sm"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TABLE_STATE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="secondary"
                        onClick={() => updateLayout(table.id, { ...table.layout, x: 20, y: 20 })}
                        className="justify-start"
                      >
                        Reset position
                      </Button>
                    </div>
                  </div>
                ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
