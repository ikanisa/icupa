import contactsFixture from "../../../ops/fixtures/sos_contacts.json" assert { type: "json" };
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

interface SosActionBody {
  contact_id?: unknown;
  action?: unknown;
  note?: unknown;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("sos-contacts");
  }

  if (req.method === "GET") {
    const contacts = Array.isArray(contactsFixture) ? contactsFixture : [];
    console.log(
      JSON.stringify({
        level: "INFO",
        event: "support.sos.contacts",
        fn: "sos-contacts",
        requestId,
        total: contacts.length,
      }),
    );
    return jsonResponse({ ok: true, contacts, request_id: requestId });
  }

  if (req.method === "POST") {
    let payload: SosActionBody;
    try {
      payload = (await req.json()) as SosActionBody;
    } catch (_error) {
      return jsonResponse({ ok: false, error: "invalid_json" }, 400);
    }

    const contactId = typeof payload.contact_id === "string" ? payload.contact_id : null;
    const action = typeof payload.action === "string" ? payload.action.toLowerCase() : "unknown";
    const note = typeof payload.note === "string" ? payload.note : undefined;

    console.log(
      JSON.stringify({
        level: "INFO",
        event: "support.sos.action",
        fn: "sos-contacts",
        requestId,
        contactId,
        action,
        note,
      }),
    );

    return jsonResponse({ ok: true, contact_id: contactId, action, request_id: requestId });
  }

  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
}, { fn: "sos-contacts" });

Deno.serve(handler);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
