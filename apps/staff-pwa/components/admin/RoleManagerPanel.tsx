'use client';

import { useMemo, useState } from "react";
import { Card } from "@icupa/ui/card";
import { Button } from "@icupa/ui/button";
import { Input } from "@icupa/ui/input";
import { Label } from "@icupa/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@icupa/ui/select";
import { Badge } from "@icupa/ui/badge";
import { Skeleton } from "@icupa/ui/skeleton";
import { Alert, AlertDescription } from "@icupa/ui/alert";
import { useToast } from "@icupa/ui/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client";
import { useTenantStaff } from "@/hooks/useTenantStaff";

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "cashier", label: "Cashier" },
  { value: "server", label: "Server" },
  { value: "chef", label: "Chef" },
  { value: "kds", label: "KDS" },
  { value: "auditor", label: "Auditor" },
  { value: "support", label: "Support" },
];

interface RoleManagerPanelProps {
  tenantId: string | null;
}

interface InvitePayload {
  email: string;
  role: string;
}

interface RemovePayload {
  userId: string;
  email: string | null;
}

export function RoleManagerPanel({ tenantId }: RoleManagerPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: staff, isLoading, isError } = useTenantStaff(tenantId);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("manager");

  const inviteMutation = useMutation({
    mutationFn: async ({ email: targetEmail, role: targetRole }: InvitePayload) => {
      if (!tenantId) {
        throw new Error("No tenant selected");
      }
      const { data, error } = await supabase.functions.invoke("admin/user_roles", {
        body: { action: "add", tenantId, email: targetEmail, role: targetRole },
      });
      if (error) {
        throw error;
      }
      if (data && "error" in data && data.error) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to invite staff member");
      }
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Invite sent",
        description: "The staff member has been invited successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "tenant-staff", tenantId] });
      setEmail("");
      setRole("manager");
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Invite failed",
        description: error instanceof Error ? error.message : "Unable to invite staff member.",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ userId, email: targetEmail }: RemovePayload) => {
      if (!tenantId) {
        throw new Error("No tenant selected");
      }
      const { data, error } = await supabase.functions.invoke("admin/user_roles", {
        body: { action: "remove", tenantId, userId, email: targetEmail ?? undefined },
      });
      if (error) {
        throw error;
      }
      if (data && "error" in data && data.error) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to remove staff member");
      }
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Access revoked",
        description: "The staff member has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "tenant-staff", tenantId] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Removal failed",
        description: error instanceof Error ? error.message : "Unable to remove staff member.",
      });
    },
  });

  const inviteDisabled = useMemo(() => {
    if (!email.trim()) return true;
    if (!role) return true;
    const alreadyAssigned = (staff ?? []).some(
      (member) => member.email?.toLowerCase() === email.trim().toLowerCase() && member.role === role,
    );
    return alreadyAssigned;
  }, [email, role, staff]);

  if (!tenantId) {
    return (
      <Card className="glass-card border border-white/10 bg-white/10 p-6 text-white">
        <p className="text-sm text-white/70">Select a tenant to manage access.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="glass-card border border-white/10 bg-white/10 p-6 text-white">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex-1 space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="staff-email" className="text-xs uppercase tracking-wide text-white/60">
                Staff email
              </Label>
              <Input
                id="staff-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="staff@example.com"
                className="bg-white/10 text-white placeholder:text-white/50"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs uppercase tracking-wide text-white/60">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="bg-white/10 text-left text-white">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-black">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            type="button"
            disabled={inviteDisabled || inviteMutation.isLoading}
            onClick={() => inviteMutation.mutate({ email: email.trim().toLowerCase(), role })}
            className="rounded-2xl bg-white text-primary md:w-48"
          >
            {inviteMutation.isLoading ? "Inviting…" : "Invite staff"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-white/60">
          Invited users receive a Supabase magic link. Owners, admins, and support can manage other staff once they accept.
        </p>
      </Card>

      <Card className="glass-card border border-white/10 bg-white/10 p-6 text-white">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/60">Team</p>
            <h3 className="text-xl font-semibold">Tenant staff roster</h3>
          </div>
          <Badge variant="outline" className="border-white/20 text-white/70">
            {(staff ?? []).length} members
          </Badge>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full bg-white/10" />
            ))}
          </div>
        ) : isError ? (
          <Alert variant="destructive" className="border-red-500/40 bg-red-500/10 text-white">
            <AlertDescription>Failed to load staff members. Please try again.</AlertDescription>
          </Alert>
        ) : staff && staff.length > 0 ? (
          <ul className="divide-y divide-white/10">
            {staff.map((member) => {
              const status = member.lastSignInAt
                ? "Active"
                : member.emailConfirmedAt
                  ? "Pending login"
                  : "Invite sent";
              return (
                <li key={`${member.userId}-${member.role}`} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-white">
                      {member.displayName ?? member.email ?? "Unknown user"}
                    </p>
                    <p className="text-xs text-white/60">
                      {member.email ?? "No email on file"} • Role:&nbsp;
                      <span className="uppercase">{member.role}</span>
                    </p>
                    <p className="text-xs text-white/40">
                      {status} • Granted {member.grantedAt ? new Date(member.grantedAt).toLocaleString() : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-white/10 text-white/70">{status}</Badge>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/30 text-white hover:bg-white/20"
                      onClick={() => removeMutation.mutate({ userId: member.userId, email: member.email })}
                      disabled={removeMutation.isLoading}
                    >
                      {removeMutation.isLoading ? "Removing…" : "Remove"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-white/20 p-6 text-center text-white/60">
            No staff members have been added yet. Invite teammates using the form above.
          </div>
        )}
      </Card>
    </div>
  );
}
