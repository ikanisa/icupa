import { CardGlass, Stepper } from "@ecotrips/ui";
import { SupplierSlaHeatmap } from "./supplier-sla-heatmap";

import { createAdminServerClient } from "../../lib/supabaseServer";

type SupplierQueueRow = {
  id: string;
  supplier_name: string;
  contact_email: string;
  onboarding_stage: string;
  status: string;
  priority: number;
  assigned_admin: string;
  hours_open: number;
};

type OfflineCoverageRow = {
  region: string;
  country_code: string;
  availability_percent: number;
  offline_suppliers: number;
  sample_size: number;
  health_label: string;
};

async function loadSupplierQueue(): Promise<SupplierQueueRow[]> {
  const supabase = await createAdminServerClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from<SupplierQueueRow>("ops.v_supplier_onboarding_queue")
    .select("id,supplier_name,contact_email,onboarding_stage,status,priority,assigned_admin,hours_open")
    .order("priority", { ascending: true })
    .limit(4);
  if (error) {
    console.error("ops.v_supplier_onboarding_queue", error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

async function loadOfflineCoverage(): Promise<OfflineCoverageRow[]> {
  const supabase = await createAdminServerClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from<OfflineCoverageRow>("ops.v_offline_coverage")
    .select("region,country_code,availability_percent,offline_suppliers,sample_size,health_label")
    .order("availability_percent", { ascending: true })
    .limit(4);
  if (error) {
    console.error("ops.v_offline_coverage", error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export default async function DashboardPage() {
  const [queue, coverage] = await Promise.all([loadSupplierQueue(), loadOfflineCoverage()]);

import { FinopsCostPanel } from "./FinopsCostPanel";

export default function DashboardPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <GrowthSnapshots />
      </div>
      <CardGlass
        title="Ops Status"
        subtitle="Realtime summary of incidents, bookings, and exceptions"
      >
        <ul className="grid gap-3 text-sm">
          <li className="flex items-center justify-between">
            <span>Open incidents</span>
            <span className="font-semibold text-amber-200">0</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Exceptions queue</span>
            <span className="font-semibold text-rose-200">3 (2 retriable)</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Escrows meeting target</span>
            <span className="font-semibold text-emerald-200">74%</span>
          </li>
        </ul>
      </CardGlass>
      <CardGlass
        title="Daily Runbook"
        subtitle="Follow the morning ops sweep to keep ecoTrips healthy"
      >
        <Stepper
          steps={[
            { id: "exceptions", label: "Review open exceptions", status: "complete" },
            { id: "bookings", label: "Check bookings with pending confirmations", status: "current" },
            { id: "drill", label: "DR drill scheduled for 14:00", status: "pending" },
          ]}
        />
      </CardGlass>
      <FinopsCostPanel />
      <CardGlass
        title="Supplier onboarding queue"
        subtitle="Highest-priority suppliers with SLA risk flagged for follow-up"
      >
        {queue.length === 0 ? (
          <p className="text-sm text-white/70">No onboarding records available. Verify ops.v_supplier_onboarding_queue access.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {queue.map((item) => (
              <li key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between text-white">
                  <span className="font-semibold">{item.supplier_name}</span>
                  <span className="text-xs uppercase tracking-wide text-white/60">P{item.priority}</span>
                </div>
                <p className="text-xs text-white/60">{item.contact_email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/70">
                  <span className="rounded-full bg-amber-500/20 px-2 py-1">{item.onboarding_stage}</span>
                  <span className="rounded-full bg-sky-500/20 px-2 py-1">{item.status}</span>
                  {item.assigned_admin && <span className="rounded-full bg-white/10 px-2 py-1">{item.assigned_admin}</span>}
                  <span className="text-white/50">{Math.round(item.hours_open)}h open</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardGlass>
      <CardGlass
        title="Offline coverage"
        subtitle="Regions trending towards degraded supplier availability"
      >
        {coverage.length === 0 ? (
          <p className="text-sm text-white/70">No offline coverage telemetry available.</p>
        ) : (
          <table className="w-full border-collapse text-left text-xs text-white/80">
            <thead>
              <tr className="text-white/50">
                <th className="pb-2 font-normal">Region</th>
                <th className="pb-2 font-normal">Availability</th>
                <th className="pb-2 font-normal">Offline</th>
                <th className="pb-2 font-normal">Sample</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {coverage.map((row) => (
                <tr key={`${row.region}-${row.country_code}`}>
                  <td className="py-2">
                    <span className="font-medium text-white">{row.region}</span>
                    <span className="ml-2 text-white/60">{row.country_code}</span>
                  </td>
                  <td className="py-2 text-white">
                    {row.availability_percent.toFixed(1)}%
                    <span className="ml-1 text-xs uppercase text-white/50">{row.health_label}</span>
                  </td>
                  <td className="py-2">{row.offline_suppliers}</td>
                  <td className="py-2">{row.sample_size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardGlass>
      <CardGlass
        className="md:col-span-2 xl:col-span-4"
        title="Supplier SLA Heatmap"
        subtitle="Nightly forecast of supplier promise health for ops triage"
      >
        <SupplierSlaHeatmap />
      </CardGlass>
    </div>
  );
}


async function GrowthSnapshots() {
  const data = await loadGrowthData();
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <CardGlass
        title="Referral balances"
        subtitle="reward-grant keeps ledgers and balances aligned"
      >
        {data.referrals.length === 0 ? (
          <p className="text-sm text-white/70">{data.offline ? "Fixtures only — check growth tables." : "No referrals yet."}</p>
        ) : (
          <ul className="space-y-2 text-sm text-white/80">
            {data.referrals.map((row) => {
              const userId = typeof row.user_id === 'string' ? row.user_id : String(row.user_id ?? '—');
              const currency = typeof row.currency === 'string' ? row.currency : 'USD';
              const available = typeof row.available_cents === 'number'
                ? row.available_cents
                : Number(row.available_cents ?? 0);
              return (
                <li key={userId} className="flex items-center justify-between gap-3">
                  <span className="truncate">{userId.slice(0, 8)}…</span>
                  <span className="text-xs text-white/60">Avail {currency} {(available / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardGlass>
      <CardGlass
        title="Price lock telemetry"
        subtitle="price-lock-offer and hold-extend-offer audit trails"
      >
        {data.priceLocks.length === 0 ? (
          <p className="text-sm text-white/70">{data.offline ? "Fixtures powering dashboard." : "No open offers."}</p>
        ) : (
          <ul className="space-y-2 text-sm text-white/80">
            {data.priceLocks.map((offer) => {
              const status = typeof offer.status === 'string' ? offer.status : 'pending';
              const expires = typeof offer.hold_expires_at === 'string'
                ? offer.hold_expires_at.slice(11, 19)
                : 'n/a';
              return (
                <li key={String(offer.id)} className="flex items-center justify-between gap-3">
                  <span className="truncate">{status}</span>
                  <span className="text-xs text-white/60">exp {expires}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardGlass>
      <CardGlass
        title="Disruption board"
        subtitle="rebook-suggest pushes suggestions for these rows"
      >
        {data.disruptions.length === 0 ? (
          <p className="text-sm text-white/70">{data.offline ? "Fixtures only — providers-air-status offline." : "All clear."}</p>
        ) : (
          <ul className="space-y-2 text-sm text-white/80">
            {data.disruptions.map((row) => {
              const type = typeof row.disruption_type === 'string' ? row.disruption_type : 'event';
              const status = typeof row.status === 'string' ? row.status : 'open';
              return (
                <li key={String(row.id)} className="flex items-center justify-between gap-3">
                  <span className="truncate">{type}</span>
                  <span className="text-xs text-white/60">{status}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardGlass>
    </div>
  );
}

async function loadGrowthData() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return { referrals: [], priceLocks: [], disruptions: [], offline: true };
  }

  const headers: HeadersInit = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Accept-Profile': 'public',
  };

  const [referralsRes, priceLocksRes, disruptionsRes] = await Promise.allSettled([
    fetch(`${supabaseUrl}/rest/v1/referral_balances_overview?select=*&order=available_cents.desc&limit=5`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/price_lock_offer_overview?select=*&order=created_at.desc&limit=5`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/disruption_board_overview?select=*&order=created_at.desc&limit=5`, { headers }),
  ]);

  let offline = false;
  let referrals: Array<Record<string, any>> = [];
  let priceLocks: Array<Record<string, any>> = [];
  let disruptions: Array<Record<string, any>> = [];

  if (referralsRes.status === 'fulfilled') {
    if (referralsRes.value.ok) {
      referrals = await referralsRes.value.json();
    } else {
      offline = true;
    }
  } else {
    offline = true;
  }

  if (priceLocksRes.status === 'fulfilled') {
    if (priceLocksRes.value.ok) {
      priceLocks = await priceLocksRes.value.json();
    } else {
      offline = true;
    }
  } else {
    offline = true;
  }

  if (disruptionsRes.status === 'fulfilled') {
    if (disruptionsRes.value.ok) {
      disruptions = await disruptionsRes.value.json();
    } else {
      offline = true;
    }
  } else {
    offline = true;
  }

  return {
    referrals: Array.isArray(referrals) ? referrals.slice(0, 5) : [],
    priceLocks: Array.isArray(priceLocks) ? priceLocks.slice(0, 5) : [],
    disruptions: Array.isArray(disruptions) ? disruptions.slice(0, 5) : [],
    offline,
  };
}

