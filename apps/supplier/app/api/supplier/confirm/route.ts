import { NextResponse } from "next/server";
import { z } from "zod";
import { createEcoTripsFunctionClient } from "@ecotrips/api";

const ConfirmationSchema = z.object({
  orderId: z.string().min(1),
  status: z.string().default("confirmed"),
  note: z.string().optional(),
});

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = process.env.SUPPLIER_PORTAL_ACCESS_TOKEN;

  if (!supabaseUrl || !anonKey || !accessToken) {
    return NextResponse.json(
      {
        ok: false,
        error: "supplier_portal_unconfigured",
        message: "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPPLIER_PORTAL_ACCESS_TOKEN to confirm orders.",
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

  const client = createEcoTripsFunctionClient({
    supabaseUrl,
    anonKey,
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
