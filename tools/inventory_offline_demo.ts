const interceptedHandlers: Array<(request: Request) => Promise<Response> | Response> = [];
const serveDescriptor = Object.getOwnPropertyDescriptor(Deno, "serve");
if (serveDescriptor) {
  Object.defineProperty(Deno, "serve", {
    configurable: true,
    writable: true,
    value: ((handler: Parameters<typeof Deno.serve>[0]) => {
      interceptedHandlers.push(handler as (request: Request) => Promise<Response> | Response);
      return {
        finished: Promise.resolve(),
        addr: {
          hostname: "0.0.0.0",
          port: 0,
          transport: "tcp",
        },
        shutdown: async () => {},
      } as unknown as ReturnType<typeof Deno.serve>;
    }) as typeof Deno.serve,
  });
}

Deno.env.set("SUPABASE_URL", "http://localhost:54321");
Deno.env.set("SUPABASE_SERVICE_ROLE", "service-role-placeholder");
Deno.env.set("HBX_BASE", "https://api.test.hotelbeds.com");
Deno.env.set("HBX_API_KEY", "mock-key");
Deno.env.set("HBX_API_SECRET", "mock-secret");
Deno.env.set("HBX_SIGNATURE_MOCK", "1");
Deno.env.set("INVENTORY_OFFLINE", "1");
Deno.env.set("INVENTORY_CACHE_TTL_SECONDS", "600");
Deno.env.set("INVENTORY_QUOTE_CACHE_TTL_SECONDS", "120");
Deno.env.set("INVENTORY_HOLD_IDEMPOTENCY_TTL_MS", "900000");

await import("../supabase/functions/inventory-search/index.ts");
await import("../supabase/functions/inventory-quote/index.ts");
await import("../supabase/functions/inventory-hold/index.ts");

const [searchHandler, quoteHandler, holdHandler] = interceptedHandlers;

function makeRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
}

async function runDemo() {
  const searchBody = {
    city: "Kigali",
    check_in: "2025-10-01",
    check_out: "2025-10-03",
    pax: { adults: 2, children: 0 },
  };
  const searchResponse = await searchHandler!(makeRequest("https://local/inventory-search", searchBody));
  const searchJson = await searchResponse.json();

  const firstHotel = Array.isArray(searchJson.items) && searchJson.items[0]
    ? searchJson.items[0]
    : null;

  const quoteBody = {
    supplier_hotel_id: firstHotel?.supplier_hotel_id ?? "HBX-001",
    check_in: "2025-10-01",
    check_out: "2025-10-03",
    pax: { adults: 2, children: 0 },
  };
  const quoteResponse = await quoteHandler!(makeRequest("https://local/inventory-quote", quoteBody));
  const quoteJson = await quoteResponse.json();

  const holdBody = {
    supplier_hotel_id: firstHotel?.supplier_hotel_id ?? "HBX-001",
    plan_id: quoteJson?.quote?.plan_id ?? "STD-ROOM-BB",
    check_in: "2025-10-01",
    check_out: "2025-10-03",
    pax: { adults: 2, children: 0 },
    idempotency_key: crypto.randomUUID(),
  };
  const holdResponse = await holdHandler!(makeRequest("https://local/inventory-hold", holdBody));
  const holdJson = await holdResponse.json();

  console.log(JSON.stringify({ search: searchJson, quote: quoteJson, hold: holdJson }, null, 2));
}

await runDemo();
