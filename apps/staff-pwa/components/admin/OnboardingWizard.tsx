import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { Button } from "@icupa/ui/button";
import { Card } from "@icupa/ui/card";
import { Input } from "@icupa/ui/input";
import { Label } from "@icupa/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@icupa/ui/select";
import { useToast } from "@icupa/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface OnboardingWizardProps {
  onTenantCreated?: (tenantId: string) => void;
}

interface FormState {
  tenantName: string;
  region: "RW" | "EU";
  locationName: string;
  currency: string;
  timezone: string;
  managerUserId: string;
  managerRole: string;
  adminToken: string;
}

const REGION_DEFAULTS: Record<"RW" | "EU", { currency: string; timezone: string }> = {
  RW: { currency: "RWF", timezone: "Africa/Kigali" },
  EU: { currency: "EUR", timezone: "Europe/Malta" },
};

export function OnboardingWizard({ onTenantCreated }: OnboardingWizardProps) {
  const [form, setForm] = useState<FormState>({
    tenantName: "",
    region: "RW",
    locationName: "",
    currency: REGION_DEFAULTS.RW.currency,
    timezone: REGION_DEFAULTS.RW.timezone,
    managerUserId: "",
    managerRole: "admin",
    adminToken: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  function handleRegionChange(nextRegion: "RW" | "EU") {
    setForm((prev) => ({
      ...prev,
      region: nextRegion,
      currency: REGION_DEFAULTS[nextRegion].currency,
      timezone: REGION_DEFAULTS[nextRegion].timezone,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    if (!form.adminToken.trim()) {
      toast({
        title: "Admin token required",
        description: "Provide the onboarding admin token before creating a tenant.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        tenant_name: form.tenantName.trim() || "New ICUPA Tenant",
        region: form.region,
        location_name: form.locationName.trim() || undefined,
        currency: form.currency.trim() || undefined,
        timezone: form.timezone.trim() || undefined,
        manager_user_id: form.managerUserId.trim() || undefined,
        manager_role: form.managerRole.trim() || undefined,
      };

      const { data, error } = await supabase.functions.invoke("admin/onboard_tenant", {
        headers: { Authorization: `Bearer ${form.adminToken.trim()}` },
        body: payload,
      });

      if (error) {
        throw error;
      }

      const result = data as { tenant_id?: string; message?: string };
      toast({
        title: "Tenant created",
        description: result.message ?? "The onboarding wizard finished successfully.",
      });

      if (result.tenant_id) {
        queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
        onTenantCreated?.(result.tenant_id);
      }

      setForm((prev) => ({
        ...prev,
        tenantName: "",
        locationName: "",
        managerUserId: "",
        adminToken: "",
      }));
    } catch (error: any) {
      console.error("onboard_tenant failed", error);
      toast({
        title: "Onboarding failed",
        description: error?.message ?? "Unexpected error while creating tenant.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="glass-card border border-white/10 bg-white/10 p-6 text-white shadow-lg">
      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="tenant-name">Tenant name</Label>
          <Input
            id="tenant-name"
            value={form.tenantName}
            onChange={(event) => setForm((prev) => ({ ...prev, tenantName: event.target.value }))}
            placeholder="Example – Kigali Rooftop"
            className="bg-white/10 text-white placeholder:text-white/50"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Region</Label>
            <Select value={form.region} onValueChange={(value) => handleRegionChange(value as "RW" | "EU")}> 
              <SelectTrigger className="bg-white/10 text-left text-white">
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RW">Rwanda</SelectItem>
                <SelectItem value="EU">Malta / EU</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="location-name">Primary location name</Label>
            <Input
              id="location-name"
              value={form.locationName}
              onChange={(event) => setForm((prev) => ({ ...prev, locationName: event.target.value }))}
              placeholder="Flagship venue"
              className="bg-white/10 text-white placeholder:text-white/50"
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              value={form.currency}
              onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
              maxLength={3}
              className="bg-white/10 text-white placeholder:text-white/50"
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              value={form.timezone}
              onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}
              placeholder="Africa/Kigali"
              className="bg-white/10 text-white placeholder:text-white/50"
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="manager-user-id">Manager user ID (optional)</Label>
            <Input
              id="manager-user-id"
              value={form.managerUserId}
              onChange={(event) => setForm((prev) => ({ ...prev, managerUserId: event.target.value }))}
              placeholder="UUID from auth.users"
              className="bg-white/10 text-white placeholder:text-white/50"
            />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={form.managerRole} onValueChange={(value) => setForm((prev) => ({ ...prev, managerRole: value }))}>
              <SelectTrigger className="bg-white/10 text-left text-white">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="support">Support</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="admin-token">Admin token</Label>
          <Input
            id="admin-token"
            value={form.adminToken}
            onChange={(event) => setForm((prev) => ({ ...prev, adminToken: event.target.value }))}
            placeholder="One-time onboarding secret"
            className="bg-white/10 text-white placeholder:text-white/50"
            type="password"
            autoComplete="off"
          />
        </div>

        <Button type="submit" disabled={isSubmitting} className="mt-2 self-start rounded-2xl bg-white text-primary">
          {isSubmitting ? "Creating tenant…" : "Create tenant"}
        </Button>
      </form>
    </Card>
  );
}
