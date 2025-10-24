import { CardGlass } from "@ecotrips/ui";

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
