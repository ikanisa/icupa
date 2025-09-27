import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  DsrRequest,
  DsrRequestStatus,
  DsrRequestType,
  useCreateDsrRequest,
  useDsrRequests,
  useUpdateDsrRequest,
} from "@/hooks/useDsrRequests";

interface DsrRequestsPanelProps {
  tenantId: string;
  tenantRegion: "RW" | "EU";
}

interface NewRequestState {
  subjectIdentifier: string;
  contactEmail: string;
  requestType: DsrRequestType;
  notes: string;
}

const DEFAULT_REQUEST: NewRequestState = {
  subjectIdentifier: "",
  contactEmail: "",
  requestType: "export",
  notes: "",
};

const STATUS_LABELS: Record<DsrRequestStatus, string> = {
  queued: "Queued",
  in_progress: "In progress",
  completed: "Completed",
  failed: "Failed",
};

const STATUS_VARIANTS: Record<DsrRequestStatus, string> = {
  queued: "bg-white/10 text-white",
  in_progress: "bg-amber-500/20 text-amber-100",
  completed: "bg-emerald-500/20 text-emerald-100",
  failed: "bg-red-500/20 text-red-100",
};

const TYPE_LABELS: Record<DsrRequestType, string> = {
  export: "Export",
  delete: "Delete",
};

export function DsrRequestsPanel({ tenantId, tenantRegion }: DsrRequestsPanelProps) {
  const { data, isLoading } = useDsrRequests(tenantId);
  const createRequest = useCreateDsrRequest(tenantId);
  const updateRequest = useUpdateDsrRequest(tenantId);
  const [newRequest, setNewRequest] = useState<NewRequestState>(DEFAULT_REQUEST);
  const { toast } = useToast();

  const queuedCount = useMemo(() => data?.filter((request) => request.status !== "completed").length ?? 0, [data]);

  const handleRunbookCopy = async () => {
    const runbookPath = "docs/runbooks/dsr-requests.md";
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(runbookPath);
        toast({ title: "Runbook path copied", description: `Open ${runbookPath} for the full SOP.` });
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch (error) {
      console.warn("clipboard unavailable", error);
      toast({
        title: "Runbook path",
        description: runbookPath,
      });
    }
  };

  if (isLoading) {
    return <Skeleton className="h-48 w-full bg-white/10" />;
  }

  return (
    <Card className="glass-card border border-white/10 bg-white/10 p-5 text-white">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/60">DSR intake</p>
          <p className="text-sm text-white/60">
            Log GDPR/Rwanda DPL export or deletion requests and track fulfilment without leaving the console.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-white/10 text-xs text-white/70">{queuedCount} open</Badge>
          <Button variant="outline" className="border-white/30 text-xs text-white hover:bg-white/20" onClick={handleRunbookCopy}>
            Copy runbook path
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className="grid gap-2 lg:col-span-2">
          <label className="text-xs uppercase tracking-widest text-white/60" htmlFor="dsr-subject">
            Subject identifier
          </label>
          <Input
            id="dsr-subject"
            value={newRequest.subjectIdentifier}
            onChange={(event) => setNewRequest((prev) => ({ ...prev, subjectIdentifier: event.target.value }))}
            placeholder="Email, user id, or loyalty id"
            className="bg-white/10 text-white placeholder:text-white/50"
          />
        </div>

        <div className="grid gap-2 lg:col-span-2">
          <label className="text-xs uppercase tracking-widest text-white/60" htmlFor="dsr-contact">
            Contact email (optional)
          </label>
          <Input
            id="dsr-contact"
            value={newRequest.contactEmail}
            onChange={(event) => setNewRequest((prev) => ({ ...prev, contactEmail: event.target.value }))}
            placeholder="privacy@tenant.test"
            className="bg-white/10 text-white placeholder:text-white/50"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-xs uppercase tracking-widest text-white/60">Request type</label>
          <Select
            value={newRequest.requestType}
            onValueChange={(value) => setNewRequest((prev) => ({ ...prev, requestType: value as DsrRequestType }))}
          >
            <SelectTrigger className="bg-white/10 text-left text-white">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="export">Export</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <label className="text-xs uppercase tracking-widest text-white/60" htmlFor="dsr-notes">
          Notes for auditors (optional)
        </label>
        <Textarea
          id="dsr-notes"
          value={newRequest.notes}
          onChange={(event) => setNewRequest((prev) => ({ ...prev, notes: event.target.value }))}
          placeholder="Ticket reference, lawful basis, or privacy officer instructions"
          className="min-h-[80px] bg-white/10 text-white placeholder:text-white/50"
        />
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          className="rounded-xl bg-white/90 px-4 py-2 font-semibold text-black hover:bg-white"
          disabled={createRequest.isPending}
          onClick={async () => {
            if (!newRequest.subjectIdentifier.trim()) {
              toast({
                title: "Subject identifier required",
                description: "Add a diner email, loyalty id, or unique reference before logging the DSR.",
                variant: "destructive",
              });
              return;
            }

            try {
              await createRequest.mutateAsync({
                tenantId,
                region: tenantRegion,
                subjectIdentifier: newRequest.subjectIdentifier.trim(),
                contactEmail: newRequest.contactEmail.trim() || undefined,
                requestType: newRequest.requestType,
                notes: newRequest.notes.trim() || undefined,
              });
              toast({ title: "DSR request captured" });
              setNewRequest(DEFAULT_REQUEST);
            } catch (error: any) {
              console.error("create dsr request failed", error);
              toast({
                title: "Failed to capture DSR",
                description: error?.message ?? "Unexpected error capturing the request.",
                variant: "destructive",
              });
            }
          }}
        >
          {createRequest.isPending ? "Saving…" : "Log request"}
        </Button>
      </div>

      <div className="mt-6">
        <p className="text-xs uppercase tracking-widest text-white/60">Open requests</p>
        {(!data || data.length === 0) && (
          <p className="mt-3 text-sm text-white/70">No recorded DSR activity for this tenant yet.</p>
        )}

        {data && data.length > 0 ? (
          <Table className="mt-4 text-sm">
            <TableHeader>
              <TableRow className="border-white/10 text-white/60">
                <TableHead className="text-white/60">Subject</TableHead>
                <TableHead className="text-white/60">Type</TableHead>
                <TableHead className="text-white/60">Status</TableHead>
                <TableHead className="text-white/60">Requested</TableHead>
                <TableHead className="text-white/60">Completed</TableHead>
                <TableHead className="text-white/60">Notes</TableHead>
                <TableHead className="text-white/60">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((request) => (
                <DsrRow
                  key={request.id}
                  request={request}
                  onUpdate={async (patch, successMessage) => {
                    try {
                      await updateRequest.mutateAsync({ id: request.id, tenantId, patch });
                      toast({ title: successMessage ?? "DSR updated" });
                    } catch (error: any) {
                      console.error("update dsr request failed", error);
                      toast({
                        title: "Failed to update DSR",
                        description: error?.message ?? "Unexpected error updating the request.",
                        variant: "destructive",
                      });
                    }
                  }}
                  isUpdating={updateRequest.isPending}
                />
              ))}
            </TableBody>
          </Table>
        ) : null}
      </div>
    </Card>
  );
}

interface DsrRowProps {
  request: DsrRequest;
  onUpdate: (patch: DsrRowPatch, successMessage?: string) => Promise<void>;
  isUpdating: boolean;
}

interface DsrRowPatch {
  status?: DsrRequestStatus;
  notes?: string | null;
}

function DsrRow({ request, onUpdate, isUpdating }: DsrRowProps) {

  const handleNoteEdit = async () => {
    if (typeof window === "undefined") {
      return;
    }
    const existingNote = typeof request.notes?.notes === "string" ? String(request.notes.notes) : "";
    const nextNote = window.prompt("Add or update the DSR note", existingNote ?? "");
    if (nextNote === null) {
      return;
    }

    await onUpdate({ notes: nextNote.trim() ? nextNote : null }, nextNote.trim() ? "DSR note updated" : "DSR note cleared");
  };

  return (
    <TableRow className="border-white/5 align-top text-white/80">
      <TableCell className="font-medium text-white">
        <div className="flex flex-col gap-1">
          <span>{request.subjectIdentifier}</span>
          {request.contactEmail ? (
            <span className="text-xs text-white/60">{request.contactEmail}</span>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <Badge className="bg-white/10 text-xs text-white/70">{TYPE_LABELS[request.requestType]}</Badge>
      </TableCell>
      <TableCell>
          <Select
            value={request.status}
            onValueChange={async (value) => {
              const status = value as DsrRequestStatus;
              await onUpdate({ status }, status === "completed" ? "DSR marked completed" : "DSR status updated");
            }}
            disabled={isUpdating}
        >
          <SelectTrigger className="bg-white/10 text-left text-white">
            <SelectValue>
              <Badge className={STATUS_VARIANTS[request.status]}>{STATUS_LABELS[request.status]}</Badge>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_LABELS) as DsrRequestStatus[]).map((option) => (
              <SelectItem key={option} value={option}>
                {STATUS_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-xs text-white/60">
        {request.requestedAt ? new Date(request.requestedAt).toLocaleString() : "—"}
      </TableCell>
      <TableCell className="text-xs text-white/60">
        {request.completedAt ? new Date(request.completedAt).toLocaleString() : "—"}
      </TableCell>
      <TableCell className="max-w-xs whitespace-pre-wrap text-xs text-white/70">
        {typeof request.notes?.notes === "string" ? String(request.notes.notes) : "—"}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={isUpdating}
            className="border-white/30 text-xs text-white hover:bg-white/20"
            onClick={async () => {
              await handleNoteEdit();
            }}
          >
            {typeof request.notes?.notes === "string" && request.notes.notes ? "Edit note" : "Add note"}
          </Button>
          {request.status !== "completed" ? (
            <Button
              size="sm"
              className="rounded-lg bg-emerald-400/90 text-xs font-semibold text-black hover:bg-emerald-300"
              disabled={isUpdating}
              onClick={async () => {
                await onUpdate({ status: "completed" }, "DSR marked completed");
              }}
            >
              Mark completed
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
