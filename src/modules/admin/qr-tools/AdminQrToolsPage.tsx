import {
  Page,
  PageContainer,
  PageDescription,
  PageHeader,
  PageTitle,
} from "@/components/layout/Page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@icupa/ui/card";
import { Button } from "@icupa/ui/button";
import { Input } from "@icupa/ui/input";
import { Label } from "@icupa/ui/label";
import { Textarea } from "@icupa/ui/textarea";
import { classNames } from "@/styles/theme";
import { cn } from "@/lib/utils";
import { useAdminQrToolsForm } from "./hooks/useAdminQrToolsForm";

export const AdminQrToolsPage = () => {
  const { form, loading, result, updateField, submit } = useAdminQrToolsForm();

  return (
    <Page>
      <PageContainer width="narrow">
        <PageHeader className="gap-2 text-center">
          <PageTitle>Admin QR tools</PageTitle>
          <PageDescription>
            Rotate table QR payloads securely by providing a table identifier and one-time admin token.
          </PageDescription>
        </PageHeader>
        <Card className={cn(classNames.glassCard, "border-0")}> 
          <CardHeader>
            <CardTitle>Re-issue table QR</CardTitle>
            <CardDescription>
              Tokens are not stored and requests execute via the Supabase Edge Function. Provide the table identifier and
              admin token issued by the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <div className="grid gap-2">
                <Label htmlFor="table-id">Table ID</Label>
                <Input
                  id="table-id"
                  placeholder="00000000-0000-4000-8000-000000000501"
                  value={form.tableId}
                  onChange={(event) => updateField("tableId", event.target.value)}
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
                  onChange={(event) => updateField("adminToken", event.target.value)}
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
      </PageContainer>
    </Page>
  );
};

export default AdminQrToolsPage;
