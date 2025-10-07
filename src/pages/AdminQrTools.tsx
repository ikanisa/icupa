import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";

interface ReissueResponse {
  table_id: string;
  location_id: string | null;
  qr_token: string;
  signature: string;
  qr_url: string | null;
  issued_at: string;
}

const INITIAL_FORM = {
  tableId: "",
  adminToken: "",
};

const AdminQrTools = () => {
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReissueResponse | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.tableId || !form.adminToken) {
      toast({
        title: "Missing details",
        description: "Provide both the table identifier and admin token before re-issuing a QR code.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke<ReissueResponse>(
        "admin/reissue_table_qr",
        {
          body: {
            table_id: form.tableId.trim(),
          },
          headers: {
            Authorization: `Bearer ${form.adminToken.trim()}`,
          },
        }
      );

      if (error || !data) {
        throw new Error(error?.message ?? "Unable to re-issue QR code");
      }

      setResult(data);
      toast({
        title: "QR code rotated",
        description: "Distribute the refreshed QR link to replace any previous table signage.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      toast({
        title: "QR rotation failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setForm((prev) => ({ ...prev, adminToken: "" }));
    }
  };

  return (
    <div className="min-h-screen bg-aurora flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl glass-card border-0">
        <CardHeader>
          <CardTitle>Admin QR tools</CardTitle>
          <CardDescription>
            Rotate table QR payloads securely by providing a table identifier and one-time admin token.
            Tokens are not stored and requests execute via the Supabase Edge Function.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="table-id">Table ID</Label>
              <Input
                id="table-id"
                placeholder="00000000-0000-4000-8000-000000000501"
                value={form.tableId}
                onChange={(event) => setForm((prev) => ({ ...prev, tableId: event.target.value }))}
                autoComplete="off"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="admin-token">Admin token</Label>
              <Input
                id="admin-token"
                type="password"
                placeholder="Paste TABLE_QR_ADMIN_SECRET"
                value={form.adminToken}
                onChange={(event) => setForm((prev) => ({ ...prev, adminToken: event.target.value }))}
                autoComplete="off"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Re-issuing…" : "Re-issue QR"}
            </Button>
          </form>

          {result && (
            <div className="mt-6 space-y-3">
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Signed link</Label>
                <Input value={result.qr_url ?? "Set TABLE_QR_APP_BASE_URL to produce a link"} readOnly />
              </div>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">QR payload</Label>
                <Textarea value={result.qr_token} readOnly rows={3} />
              </div>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Signature</Label>
                <Textarea value={result.signature} readOnly rows={2} />
              </div>
              <p className="text-xs text-muted-foreground">
                Issued {new Date(result.issued_at).toLocaleString()} • Table {result.table_id}
                {result.location_id ? ` • Location ${result.location_id}` : ""}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminQrTools;
