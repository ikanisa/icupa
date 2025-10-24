import { CardGlass } from "@ecotrips/ui";

import { createAdminServerClient } from "../../lib/supabaseServer";
import type { AdminDatabase } from "../../../lib/databaseTypes";

type SupplierLicenceRow = AdminDatabase["ops"]["Views"]["v_supplier_licence_status"]["Row"];

function formatHours(value: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  if (value < 1) {
    return `${Math.round(value * 60)}m ago`;
  }
  if (value > 48) {
    return `${(value / 24).toFixed(1)}d ago`;
  }
  return `${value.toFixed(1)}h ago`;
}

function formatExpiry(days: number | null, iso: string | null): string {
  if (days === null || typeof days === "undefined") return iso ? iso : "—";
  if (days < 0) {
    return iso ? `${iso} (expired)` : "expired";
  }
  if (days === 0) {
    return iso ? `${iso} (today)` : "today";
  }
  return iso ? `${iso} (${days}d)` : `${days}d`;
}

async function loadSupplierCompliance(): Promise<{ rows: SupplierLicenceRow[]; offline: boolean }> {
  const supabase = await createAdminServerClient();
  if (!supabase) {
    return { rows: [], offline: true };
  }
  const { data, error } = await supabase
    .from<SupplierLicenceRow>("ops.v_supplier_licence_status")
    .select(
      "supplier_id,supplier_slug,display_name,licence_status,licence_expires_at,licence_document_path,menu_document_path,last_ingested_at,ingestion_source,days_until_expiry,hours_since_ingest",
    )
    .order("display_name", { ascending: true });
  if (error) {
    console.error("ops.v_supplier_licence_status", error);
    return { rows: [], offline: true };
  }
  return { rows: Array.isArray(data) ? data : [], offline: false };
}

export default async function SuppliersPage() {
  const { rows, offline } = await loadSupplierCompliance();

  return (
    <div className="space-y-6">
      <CardGlass
        title="Supplier licence compliance"
        subtitle="Backed by travel.suppliers and storage buckets for documents and menus"
      >
        {rows.length === 0 ? (
          <p className="text-sm text-white/70">
            {offline
              ? "Unable to reach ops.v_supplier_licence_status — verify service role access."
              : "No supplier compliance records available yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm text-white/80">
              <thead className="text-xs uppercase tracking-wide text-white/50">
                <tr>
                  <th className="px-3 pb-2 font-normal">Supplier</th>
                  <th className="px-3 pb-2 font-normal">Licence</th>
                  <th className="px-3 pb-2 font-normal">Expires</th>
                  <th className="px-3 pb-2 font-normal">Last ingestion</th>
                  <th className="px-3 pb-2 font-normal">Documents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rows.map((row) => {
                  const expiry = formatExpiry(row.days_until_expiry, row.licence_expires_at);
                  const lastIngested = formatHours(row.hours_since_ingest);
                  return (
                    <tr key={row.supplier_id}>
                      <td className="px-3 py-3 align-top">
                        <div className="font-semibold text-white">{row.display_name}</div>
                        <div className="text-xs text-white/60">{row.supplier_slug}</div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className="rounded-full bg-white/10 px-2 py-1 text-xs uppercase tracking-wide">
                          {row.licence_status}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">{expiry}</td>
                      <td className="px-3 py-3 align-top">
                        <div>{lastIngested}</div>
                        {row.ingestion_source && (
                          <div className="text-xs text-white/50">via {row.ingestion_source}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-col gap-1 text-xs text-white/70">
                          {row.licence_document_path ? (
                            <span className="truncate">licence: {row.licence_document_path}</span>
                          ) : (
                            <span className="text-white/40">licence pending upload</span>
                          )}
                          {row.menu_document_path ? (
                            <span className="truncate">menu: {row.menu_document_path}</span>
                          ) : (
                            <span className="text-white/40">menu asset not linked</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardGlass>
      <CardGlass
        title="Storage buckets"
        subtitle="supplier-licences and supplier-menus buckets are private with ops-only access"
      >
        <ul className="space-y-2 text-sm text-white/70">
          <li>
            <span className="font-semibold text-white">supplier-licences</span> — ops can audit uploads, service role writes.
            Paths stored on <code>travel.suppliers.licence_document_path</code>.
          </li>
          <li>
            <span className="font-semibold text-white">supplier-menus</span> — authenticated ops and partners can read, service
            role manages writes. Referenced via <code>travel.suppliers.menu_document_path</code>.
          </li>
        </ul>
      </CardGlass>
    </div>
  );
}
