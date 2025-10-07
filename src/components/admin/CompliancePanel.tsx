import { useMemo, useState } from "react";
import {
  useComplianceTasks,
  useCreateComplianceTask,
  useUpdateComplianceTask,
  ComplianceTask,
} from "@/hooks/useComplianceTasks";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { DsrRequestsPanel } from "@/components/admin/DsrRequestsPanel";
import { FiscalizationSlaCard } from "@/components/admin/FiscalizationSlaCard";
import { AiDisclosureEditor } from "@/components/admin/AiDisclosureEditor";
import { KybcChecklist } from "@/components/admin/KybcChecklist";
import { OfflineSyncSummaryCard } from "@/components/admin/OfflineSyncSummaryCard";

interface CompliancePanelProps {
  tenantId: string | null;
  tenantRegion?: "RW" | "EU";
  scope?: "tenant" | "platform";
}

interface NewTaskState {
  category: string;
  title: string;
  severity: ComplianceTask["severity"];
  dueDate: string;
  notes: string;
}

const DEFAULT_NEW_TASK: NewTaskState = {
  category: "fiscalization",
  title: "",
  severity: "medium",
  dueDate: "",
  notes: "",
};

const SEVERITY_VARIANTS: Record<string, string> = {
  low: "bg-emerald-500/20 text-emerald-100",
  medium: "bg-amber-500/20 text-amber-100",
  high: "bg-orange-500/20 text-orange-100",
  critical: "bg-red-500/20 text-red-100",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In progress",
  blocked: "Blocked",
  resolved: "Resolved",
};

const CATEGORY_OPTIONS = [
  { value: "fiscalization", label: "Fiscalisation" },
  { value: "ai_disclosure", label: "AI disclosure" },
  { value: "dsa_kybc", label: "DSA / KYBC" },
  { value: "privacy", label: "Privacy" },
  { value: "safety", label: "Safety" },
];

const STATUS_OPTIONS: ComplianceTask["status"][] = ["pending", "in_progress", "blocked", "resolved"];
const SEVERITY_OPTIONS: ComplianceTask["severity"][] = ["low", "medium", "high", "critical"];

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return fallback;
}

export function CompliancePanel({ tenantId, tenantRegion = "RW", scope = "tenant" }: CompliancePanelProps) {
  const isPlatformScope = scope === "platform";
  const effectiveTenantId = isPlatformScope ? null : tenantId;

  const { data, isLoading } = useComplianceTasks(effectiveTenantId);
  const { toast } = useToast();
  const createTask = useCreateComplianceTask(effectiveTenantId);
  const updateTask = useUpdateComplianceTask(effectiveTenantId);
  const [newTask, setNewTask] = useState<NewTaskState>(DEFAULT_NEW_TASK);
  const [editingDueDates, setEditingDueDates] = useState<Record<string, string>>({});
  const [pendingUpdateId, setPendingUpdateId] = useState<string | null>(null);

  const overdueTasks = useMemo(() => {
    if (!data) return 0;
    const now = Date.now();
    return data.filter((task) => {
      if (!task.dueAt || task.status === "resolved") return false;
      return new Date(task.dueAt).getTime() < now;
    }).length;
  }, [data]);

  if (isPlatformScope) {
    return (
      <Card className="glass-card border border-white/10 bg-white/10 p-5 text-white">
        <p className="text-sm text-white/70">
          Compliance tasks, SLA tracking, and DSR intake are tenant-scoped. Choose a tenant to review fiscalisation, disclosure,
          and privacy follow-ups.
        </p>
      </Card>
    );
  }

  if (!tenantId) {
    return <p className="text-sm text-white/70">Select a tenant to review compliance data.</p>;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full bg-white/10" />
        <Skeleton className="h-48 w-full bg-white/10" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FiscalizationSlaCard tenantId={tenantId} />

      <OfflineSyncSummaryCard tenantId={tenantId} />

      <AiDisclosureEditor tenantId={tenantId} tenantRegion={tenantRegion} />

      <KybcChecklist tenantId={tenantId} tenantRegion={tenantRegion} />

      <Card className="glass-card border border-white/10 bg-white/10 p-5 text-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/60">Create compliance task</p>
            <p className="text-sm text-white/60">Track fiscalisation, AI disclosure, and DSA follow-ups directly from ops.</p>
          </div>
          {overdueTasks > 0 ? (
            <Badge className="bg-red-500/20 text-red-100">{overdueTasks} overdue</Badge>
          ) : (
            <Badge className="bg-emerald-500/20 text-emerald-100">All caught up</Badge>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-widest text-white/60" htmlFor="task-category">
              Category
            </label>
            <Select
              value={newTask.category}
              onValueChange={(value) => setNewTask((prev) => ({ ...prev, category: value }))}
            >
              <SelectTrigger id="task-category" className="bg-white/10 text-left text-white">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-widest text-white/60" htmlFor="task-severity">
              Severity
            </label>
            <Select
              value={newTask.severity}
              onValueChange={(value) => setNewTask((prev) => ({ ...prev, severity: value as NewTaskState["severity"] }))}
            >
              <SelectTrigger id="task-severity" className="bg-white/10 text-left text-white">
                <SelectValue placeholder="Select severity" />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-widest text-white/60" htmlFor="task-due-date">
              Due date
            </label>
            <Input
              id="task-due-date"
              type="date"
              value={newTask.dueDate}
              onChange={(event) => setNewTask((prev) => ({ ...prev, dueDate: event.target.value }))}
              className="bg-white/10 text-white"
            />
          </div>

          <div className="grid gap-2 sm:col-span-2 lg:col-span-1">
            <label className="text-xs uppercase tracking-widest text-white/60" htmlFor="task-title">
              Title
            </label>
            <Input
              id="task-title"
              value={newTask.title}
              onChange={(event) => setNewTask((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Draft fiscalisation response"
              className="bg-white/10 text-white placeholder:text-white/50"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          <label className="text-xs uppercase tracking-widest text-white/60" htmlFor="task-notes">
            Notes
          </label>
          <Textarea
            id="task-notes"
            value={newTask.notes}
            onChange={(event) => setNewTask((prev) => ({ ...prev, notes: event.target.value }))}
            placeholder="Provide context or links that auditors should review."
            className="min-h-[90px] bg-white/10 text-white placeholder:text-white/50"
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            onClick={async () => {
              if (!newTask.title.trim()) {
                toast({
                  title: "Task title required",
                  description: "Add a short title before creating a compliance item.",
                  variant: "destructive",
                });
                return;
              }

              if (!tenantId) {
                toast({
                  title: "Tenant required",
                  description: "Select a tenant before creating compliance tasks.",
                  variant: "destructive",
                });
                return;
              }

              try {
                await createTask.mutateAsync({
                  tenantId,
                  region: tenantRegion,
                  category: newTask.category,
                  title: newTask.title.trim(),
                  severity: newTask.severity,
                  dueDate: newTask.dueDate || null,
                  details: {
                    notes: newTask.notes.trim() || undefined,
                    source: "admin_console",
                  },
                });
                toast({ title: "Compliance task created" });
                setNewTask(DEFAULT_NEW_TASK);
                setEditingDueDates({});
              } catch (error) {
                console.error("create compliance task failed", error);
                toast({
                  title: "Failed to create task",
                  description: getErrorMessage(error, "Unexpected error creating compliance task."),
                  variant: "destructive",
                });
              }
            }}
            disabled={createTask.isPending}
            className="rounded-xl bg-white/90 px-4 py-2 font-semibold text-black hover:bg-white"
          >
            {createTask.isPending ? "Saving…" : "Add task"}
          </Button>
        </div>
      </Card>

      <Card className="glass-card border border-white/10 bg-white/10 p-4 text-white">
        <p className="text-xs uppercase tracking-widest text-white/60">Compliance dashboard</p>

        {(!data || data.length === 0) && (
          <p className="mt-4 text-sm text-white/70">No outstanding compliance tasks for this tenant.</p>
        )}

        {data && data.length > 0 ? (
          <Table className="mt-4 text-sm">
            <TableHeader>
              <TableRow className="border-white/10 text-white/60">
                <TableHead className="text-white/60">Category</TableHead>
                <TableHead className="text-white/60">Title &amp; notes</TableHead>
                <TableHead className="text-white/60">Status</TableHead>
                <TableHead className="text-white/60">Severity</TableHead>
                <TableHead className="text-white/60">Due</TableHead>
                <TableHead className="text-white/60">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((task) => {
                const dueDateValue = editingDueDates[task.id] ?? (task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : "");

                return (
                  <TableRow key={task.id} className="border-white/5 align-top">
                    <TableCell className="font-medium capitalize text-white">
                      {task.category.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="text-white/80">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{task.title}</span>
                        {task.details?.notes ? (
                          <span className="text-xs text-white/60">{String(task.details.notes)}</span>
                        ) : null}
                        {task.resolvedAt ? (
                          <span className="text-xs text-emerald-200/80">
                            Resolved {new Date(task.resolvedAt).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="w-40">
                      <Select
                        value={task.status}
                        onValueChange={async (value) => {
                          if (!tenantId) return;
                          setPendingUpdateId(task.id);
                          try {
                            await updateTask.mutateAsync({
                              id: task.id,
                              tenantId,
                              patch: { status: value as ComplianceTask["status"] },
                            });
                            toast({ title: `Status updated to ${STATUS_LABELS[value] ?? value}` });
                          } catch (error) {
                            console.error("update compliance status failed", error);
                            toast({
                              title: "Failed to update status",
                              description: getErrorMessage(error, "Unexpected error updating status."),
                              variant: "destructive",
                            });
                          } finally {
                            setPendingUpdateId(null);
                          }
                        }}
                        disabled={pendingUpdateId === task.id && updateTask.isPending}
                      >
                        <SelectTrigger className="bg-white/10 text-left text-white">
                          <SelectValue>{STATUS_LABELS[task.status] ?? task.status}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {STATUS_LABELS[option] ?? option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="w-36">
                      <Select
                        value={task.severity}
                        onValueChange={async (value) => {
                          if (!tenantId) return;
                          setPendingUpdateId(task.id);
                          try {
                            await updateTask.mutateAsync({
                              id: task.id,
                              tenantId,
                              patch: { severity: value as ComplianceTask["severity"] },
                            });
                            toast({ title: `Severity updated to ${value.toUpperCase()}` });
                          } catch (error) {
                            console.error("update compliance severity failed", error);
                            toast({
                              title: "Failed to update severity",
                              description: getErrorMessage(error, "Unexpected error updating severity."),
                              variant: "destructive",
                            });
                          } finally {
                            setPendingUpdateId(null);
                          }
                        }}
                        disabled={pendingUpdateId === task.id && updateTask.isPending}
                      >
                        <SelectTrigger className="bg-white/10 text-left text-white">
                          <SelectValue>
                            <Badge className={SEVERITY_VARIANTS[task.severity] ?? "bg-white/10 text-white"}>
                              {task.severity.toUpperCase()}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {SEVERITY_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="w-40 text-white/70">
                      <Input
                        type="date"
                        value={dueDateValue}
                        onChange={async (event) => {
                          if (!tenantId) return;
                          const nextValue = event.target.value;
                          setEditingDueDates((prev) => ({ ...prev, [task.id]: nextValue }));
                          setPendingUpdateId(task.id);
                          try {
                            await updateTask.mutateAsync({
                              id: task.id,
                              tenantId,
                              patch: { dueDate: nextValue || null },
                            });
                            toast({ title: "Due date updated" });
                          } catch (error) {
                            console.error("update compliance due date failed", error);
                            toast({
                              title: "Failed to update due date",
                              description: getErrorMessage(error, "Unexpected error updating due date."),
                              variant: "destructive",
                            });
                          } finally {
                            setPendingUpdateId(null);
                          }
                        }}
                        className="bg-white/10 text-white"
                      />
                    </TableCell>
                    <TableCell className="w-32">
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            if (!tenantId) return;
                            setPendingUpdateId(task.id);
                          try {
                            await updateTask.mutateAsync({
                              id: task.id,
                              tenantId,
                              patch: { status: "resolved" },
                            });
                            toast({ title: "Task marked resolved" });
                          } catch (error) {
                            console.error("resolve compliance task failed", error);
                            toast({
                              title: "Failed to resolve task",
                              description: getErrorMessage(error, "Unexpected error resolving task."),
                              variant: "destructive",
                            });
                          } finally {
                            setPendingUpdateId(null);
                          }
                          }}
                          disabled={task.status === "resolved" || (pendingUpdateId === task.id && updateTask.isPending)}
                          className="border-white/30 text-xs text-white hover:bg-white/20"
                        >
                          Mark resolved
                        </Button>
                        {task.status !== "pending" ? (
                          <Badge className="bg-white/10 text-xs text-white/70">
                            {STATUS_LABELS[task.status] ?? task.status}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : null}
      </Card>

      <DsrRequestsPanel tenantId={tenantId!} tenantRegion={tenantRegion} />
    </div>
  );
}
