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
  if (days === null || typeof days === "undefined") return iso ?? "—";
  if (days < 0) {
    return iso ? `${iso} (expired)` : "expired";
  }
  if (days === 0) {
    return iso ? `${iso} (today)` : "today";
  }
  return iso ? `${iso} (${days}d)` : `${days}d`;
}

async function SupplierCompliancePanel({ slug, supplierName }: { slug: string; supplierName: string }) {
  const supabase = await createAdminServerClient();
  if (!supabase) {
    return (
      <CardGlass title={`${supplierName} compliance`} subtitle="Enable admin supabase env to load details">
        <p className="text-sm text-white/70">Service role credentials not configured for server-side requests.</p>
      </CardGlass>
    );
  }

  const { data, error } = await supabase
    .from<SupplierLicenceRow>("ops.v_supplier_licence_status")
    .select(
      "display_name,licence_status,licence_expires_at,licence_document_path,menu_document_path,last_ingested_at,ingestion_source,days_until_expiry,hours_since_ingest",
    )
    .eq("supplier_slug", slug)
    .maybeSingle();

  if (error) {
    console.error("supplier_compliance_fetch", error);
  }

  if (!data) {
    return (
      <CardGlass title={`${supplierName} compliance`} subtitle="Waiting for travel-discovery ingestion">
        <p className="text-sm text-white/70">
          No compliance telemetry recorded for this supplier yet. Run the travel-discovery ingestion or backfill travel.suppliers.
        </p>
      </CardGlass>
    );
  }

  const expiry = formatExpiry(data.days_until_expiry ?? null, data.licence_expires_at);
  const lastIngested = formatHours(data.hours_since_ingest ?? null);

  return (
    <CardGlass title={`${supplierName} compliance`} subtitle="Synced from travel.suppliers via travel-discovery">
      <dl className="grid gap-3 text-sm text-white/80 md:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/50">Licence status</dt>
          <dd className="mt-1 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide">
            {data.licence_status}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/50">Expires</dt>
          <dd className="mt-1">{expiry}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/50">Last ingestion</dt>
          <dd className="mt-1">
            {lastIngested}
            {data.ingestion_source && (
              <span className="ml-2 text-xs text-white/50">via {data.ingestion_source}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/50">Documents</dt>
          <dd className="mt-1 space-y-1 text-xs text-white/70">
            {data.licence_document_path ? (
              <div>licence: {data.licence_document_path}</div>
            ) : (
              <div className="text-white/40">licence pending</div>
            )}
            {data.menu_document_path ? (
              <div>menu: {data.menu_document_path}</div>
            ) : (
              <div className="text-white/40">menu asset not linked</div>
            )}
          </dd>
        </div>
      </dl>
    </CardGlass>
  );
}

type SupplierProfilePageProps = {
  params: { supplier: string };
};

function formatSupplierName(slug: string) {
  return slug
    .split("-")
    .map((piece) => piece.charAt(0).toUpperCase() + piece.slice(1))
    .join(" ");
}

export default function SupplierProfilePage({ params }: SupplierProfilePageProps) {
  const supplierSlug = params.supplier;
  const supplierName = formatSupplierName(supplierSlug);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SupplierCompliancePanel slug={supplierSlug} supplierName={supplierName} />
      <CardGlass
        title={`${supplierName} (stub)`}
        subtitle="Supplier profile drill-down placeholder wired for dashboard navigation"
      >
        <p>
          This stub route is ready to receive live data from the
          <code className="ml-2 rounded bg-white/10 px-1 py-0.5 text-xs uppercase tracking-wide">
            supplier-sla-forecast
          </code>
          edge function.
        </p>
        <p>
          Add fulfillment notes, contact details, and timeline widgets here as the
          ops experience evolves.
        </p>
      </CardGlass>
    </div>
  );
}
