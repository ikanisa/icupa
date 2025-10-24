import { CardGlass, Stepper } from "@ecotrips/ui";

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
  if (!supabaseUrl || !anonKey) {
    return { referrals: [], priceLocks: [], disruptions: [], offline: true };
  }

  const headers: HeadersInit = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
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

