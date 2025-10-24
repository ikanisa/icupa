import { cookies } from "next/headers";

import { createEcoTripsFunctionClient } from "@ecotrips/api";
import type { SupplierOrderRecord, SupplierOrdersResponse } from "@ecotrips/types";
import {
  createServerSupabaseClient,
  getSupabaseAccessToken,
  resolveSupabaseConfig,
} from "@ecotrips/supabase";

import { supplierOrderFixtures } from "./fixtures/orders";

export type LoadedSupplierOrders = {
  ok: boolean;
  source: "live" | "fixtures" | "offline" | "unauthorized";
  orders: SupplierOrderRecord[];
  requestId?: string;
};

export async function loadSupplierOrders(): Promise<LoadedSupplierOrders> {
  const config = resolveSupabaseConfig();

  if (!config) {
    return {
      ok: true,
      source: "fixtures",
      orders: supplierOrderFixtures.map(normalizeFixture),
    };
  }

  try {
    const cookieStore = cookies();
    const supabase = createServerSupabaseClient({ cookies: () => cookieStore }, { config });
    const accessToken = await getSupabaseAccessToken(supabase);

    if (!accessToken) {
      return {
        ok: false,
        source: "unauthorized",
        orders: [],
      };
    }

    const client = createEcoTripsFunctionClient({
      supabaseUrl: config.supabaseUrl,
      anonKey: config.supabaseKey,
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
    badges: record.badges?.map((badge) => ({ ...badge })),
  };
}
