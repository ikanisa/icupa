import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createEcoTripsFunctionClient } from "@ecotrips/api";
import {
  createRouteHandlerSupabaseClient,
  getSupabaseAccessToken,
  resolveSupabaseConfig,
} from "@ecotrips/supabase";

const ConfirmationSchema = z.object({
  orderId: z.string().min(1),
  status: z.string().default("confirmed"),
  note: z.string().optional(),
});

export async function POST(request: Request) {
  const config = resolveSupabaseConfig();

  if (!config) {
    return NextResponse.json(
      {
        ok: false,
        error: "supplier_portal_unconfigured",
        message: "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to confirm orders.",
      },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const parsed = ConfirmationSchema.safeParse({
    orderId: formData.get("orderId"),
    status: formData.get("status"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_payload",
        message: "Provide a valid order identifier.",
      },
      { status: 400 },
    );
  }

  const cookieStore = cookies();
  const supabase = createRouteHandlerSupabaseClient({ cookies: () => cookieStore }, { config });
  const accessToken = await getSupabaseAccessToken(supabase);

  if (!accessToken) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
        message: "Sign in to confirm supplier orders.",
      },
      { status: 401 },
    );
  }

  const client = createEcoTripsFunctionClient({
    supabaseUrl: config.supabaseUrl,
    anonKey: config.supabaseKey,
    getAccessToken: async () => accessToken,
  });

  try {
    const response = await client.call("supplier.confirm", {
      order_id: parsed.data.orderId,
      status: parsed.data.status,
      note: parsed.data.note,
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "confirmation_failed",
          requestId: response.request_id,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        order_id: response.order_id,
        status: response.status,
        request_id: response.request_id,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("supplier.confirm", error);
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
      },
      { status: 500 },
    );
  }
}
