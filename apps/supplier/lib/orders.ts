import { createEcoTripsFunctionClient } from "@ecotrips/api";
import type { SupplierOrderRecord, SupplierOrdersResponse } from "@ecotrips/types";

import { supplierOrderFixtures } from "./fixtures/orders";

export type LoadedSupplierOrders = {
  ok: boolean;
  source: "live" | "fixtures" | "offline";
  orders: SupplierOrderRecord[];
  requestId?: string;
};

export async function loadSupplierOrders(): Promise<LoadedSupplierOrders> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = process.env.SUPPLIER_PORTAL_ACCESS_TOKEN;

  if (!supabaseUrl || !anonKey || !accessToken) {
    return {
      ok: true,
      source: "fixtures",
      orders: supplierOrderFixtures.map(normalizeFixture),
    };
  }

  try {
    const client = createEcoTripsFunctionClient({
      supabaseUrl,
      anonKey,
      getAccessToken: async () => accessToken,
    });

    const response = await client.call("supplier.orders", { include_badges: true });
    if (!response.ok) {
      return {
        ok: false,
        source: "offline",
        orders: supplierOrderFixtures.map(normalizeFixture),
        requestId: response.request_id,
      };
    }
    const payload = response as SupplierOrdersResponse;
    return {
      ok: true,
      source: "live",
      orders: payload.orders ?? [],
      requestId: payload.request_id,
    };
  } catch (error) {
    console.error("supplier.orders", error);
    return {
      ok: false,
      source: "offline",
      orders: supplierOrderFixtures.map(normalizeFixture),
    };
  }
}

function normalizeFixture(record: (typeof supplierOrderFixtures)[number]): SupplierOrderRecord {
  return {
    id: record.id,
    itinerary: record.itinerary,
    start_date: record.startDate,
    travelers: record.travelers,
    status: record.status,
    total_cents: record.totalCents,
    currency: record.currency,
    notes: record.notes,
    badges: record.badges,
  };
}
