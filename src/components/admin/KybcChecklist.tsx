import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  KybcChecklistItem,
  KybcStatus,
  useCreateKybcItem,
  useKybcChecklist,
  useUpdateKybcItem,
} from "@/hooks/useKybcChecklist";

interface KybcChecklistProps {
  tenantId: string | null;
  tenantRegion: "RW" | "EU";
}

interface DraftState {
  status: KybcStatus;
  notes: string;
}

const STATUS_OPTIONS: KybcStatus[] = ["pending", "in_progress", "blocked", "resolved"];

export function KybcChecklist({ tenantId, tenantRegion }: KybcChecklistProps) {
  const { data, isLoading } = useKybcChecklist(tenantId);
  const createItem = useCreateKybcItem(tenantId);
  const updateItem = useUpdateKybcItem(tenantId);
  const { toast } = useToast();

  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [newRequirement, setNewRequirement] = useState("");
  const [newNotes, setNewNotes] = useState("");

  useEffect(() => {
    const next: Record<string, DraftState> = {};
    (data ?? []).forEach((item) => {
      next[item.id] = {
        status: item.status,
        notes: typeof item.notes?.text === "string" ? (item.notes.text as string) : "",
      };
    });
    setDrafts(next);
  }, [data]);

  const sortedItems = useMemo(() => {
    return (data ?? []).slice().sort((a, b) => a.requirement.localeCompare(b.requirement));
  }, [data]);

  if (!tenantId) {
    return null;
  }

  if (isLoading) {
    return <Skeleton className="h-48 w-full bg-white/10" />;
  }

  const handleSave = async (item: KybcChecklistItem) => {
    const draft = drafts[item.id];
    if (!draft) return;

    try {
      await updateItem.mutateAsync({
        id: item.id,
        tenantId,
        patch: {
          status: draft.status,
          notes: draft.notes ? { text: draft.notes } : {},
        },
      });
      toast({ title: "Checklist updated" });
    } catch (error: any) {
      console.error("update kybc item failed", error);
      toast({
        title: "Unable to update KYBC item",
        description: error?.message ?? "Unexpected error while saving the checklist item.",
        variant: "destructive",
      });
    }
  };

  const handleCreate = async () => {
    if (!newRequirement.trim()) {
      toast({
        title: "Requirement required",
        description: "Add a requirement description before saving.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createItem.mutateAsync({
        tenantId,
        region: tenantRegion,
        requirement: newRequirement.trim(),
        notes: newNotes.trim() ? { text: newNotes.trim() } : undefined,
      });
      setNewRequirement("");
      setNewNotes("");
      toast({ title: "Checklist item added" });
    } catch (error: any) {
      console.error("create kybc item failed", error);
      toast({
        title: "Unable to add KYBC item",
        description: error?.message ?? "Unexpected error while creating the checklist entry.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="glass-card border border-white/10 bg-white/10 p-5 text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/60">DSA / KYBC checklist</p>
          <p className="text-sm text-white/60">Track marketplace onboarding documents and verification status.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Input
          value={newRequirement}
          onChange={(event) => setNewRequirement(event.target.value)}
          placeholder="Add new requirement"
          className="bg-white/10 text-white placeholder:text-white/50"
        />
        <Input
          value={newNotes}
          onChange={(event) => setNewNotes(event.target.value)}
          placeholder="Optional notes or reference"
          className="bg-white/10 text-white placeholder:text-white/50"
        />
        <Button
          onClick={handleCreate}
          className="rounded-xl bg-white/90 px-4 py-2 font-semibold text-primary hover:bg-white"
          disabled={createItem.isPending}
        >
          {createItem.isPending ? "Saving…" : "Add requirement"}
        </Button>
      </div>

      {sortedItems.length === 0 ? (
        <p className="mt-4 text-sm text-white/70">No KYBC checklist items recorded for this tenant.</p>
      ) : (
        <Table className="mt-6 text-sm">
          <TableHeader>
            <TableRow className="border-white/10 text-white/60">
              <TableHead className="text-white/60">Requirement</TableHead>
              <TableHead className="text-white/60">Status</TableHead>
              <TableHead className="text-white/60">Notes</TableHead>
              <TableHead className="text-white/60">Last verified</TableHead>
              <TableHead className="text-white/60">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-white/10">
            {sortedItems.map((item) => {
              const draft = drafts[item.id] ?? { status: item.status, notes: "" };
              return (
                <TableRow key={item.id} className="border-white/5 text-white/80">
                  <TableCell className="font-semibold text-white">{item.requirement}</TableCell>
                  <TableCell>
                    <Select
                      value={draft.status}
                      onValueChange={(value) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [item.id]: {
                            ...prev[item.id],
                            status: value as KybcStatus,
                            notes: prev[item.id]?.notes ?? "",
                          },
                        }))
                      }
                    >
                      <SelectTrigger className="bg-white/10 text-left text-white">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option.replace(/_/g, " ").toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      value={draft.notes}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [item.id]: {
                            ...prev[item.id],
                            status: prev[item.id]?.status ?? item.status,
                            notes: event.target.value,
                          },
                        }))
                      }
                      placeholder="Add reviewer note"
                      className="bg-white/10 text-white placeholder:text-white/50"
                    />
                  </TableCell>
                  <TableCell className="text-xs text-white/60">
                    {item.lastVerifiedAt ? new Date(item.lastVerifiedAt).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/30 text-white hover:bg-white/20"
                      disabled={updateItem.isPending}
                      onClick={() => handleSave(item)}
                    >
                      {updateItem.isPending ? "Saving…" : "Save"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
