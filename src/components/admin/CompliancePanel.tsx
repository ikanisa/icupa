import { useComplianceTasks } from "@/hooks/useComplianceTasks";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface CompliancePanelProps {
  tenantId: string | null;
}

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

export function CompliancePanel({ tenantId }: CompliancePanelProps) {
  const { data, isLoading } = useComplianceTasks(tenantId);

  if (!tenantId) {
    return <p className="text-sm text-white/70">Select a tenant to review compliance tasks.</p>;
  }

  if (isLoading) {
    return <Skeleton className="h-56 w-full bg-white/10" />;
  }

  if (!data || data.length === 0) {
    return <p className="text-sm text-white/70">No outstanding compliance tasks for this tenant.</p>;
  }

  return (
    <Card className="glass-card border border-white/10 bg-white/10 p-4 text-white">
      <p className="text-xs uppercase tracking-widest text-white/60">Compliance dashboard</p>
      <Table className="mt-4 text-sm">
        <TableHeader>
          <TableRow className="border-white/10 text-white/60">
            <TableHead className="text-white/60">Category</TableHead>
            <TableHead className="text-white/60">Title</TableHead>
            <TableHead className="text-white/60">Status</TableHead>
            <TableHead className="text-white/60">Severity</TableHead>
            <TableHead className="text-white/60">Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((task) => (
            <TableRow key={task.id} className="border-white/5">
              <TableCell className="font-medium capitalize text-white">{task.category.replace(/_/g, " ")}</TableCell>
              <TableCell className="text-white/80">{task.title}</TableCell>
              <TableCell>
                <Badge className="bg-white/10 text-white/80">
                  {STATUS_LABELS[task.status] ?? task.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge className={SEVERITY_VARIANTS[task.severity] ?? "bg-white/10 text-white"}>
                  {task.severity.toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell className="text-white/70">
                {task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
