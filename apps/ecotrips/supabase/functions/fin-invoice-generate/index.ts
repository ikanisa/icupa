import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Supabase configuration missing for fin-invoice-generate");
}

type InvoiceKind = "invoice" | "credit_note";

const KIND_SET = new Set<InvoiceKind>(["invoice", "credit_note"]);
let bucketEnsured = false;

interface PaymentRecord {
  id: string;
  amount_cents: number;
  currency: string;
  provider_ref?: string;
  created_at?: string;
  itinerary_id?: string;
  status?: string;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("fin-invoice-generate");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const kind = typeof body.kind === "string" ? body.kind.trim() : "";
  if (!KIND_SET.has(kind as InvoiceKind)) {
    const error = new Error("kind must be invoice or credit_note");
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  const paymentId = typeof body.payment_id === "string"
    ? body.payment_id.trim()
    : "";
  const itineraryIdInput = typeof body.itinerary_id === "string"
    ? body.itinerary_id.trim()
    : undefined;

  if (!paymentId) {
    const error = new Error("payment_id is required");
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  const payment = await fetchPayment(paymentId);
  if (!payment) {
    const error = new Error("payment not found");
    (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
    throw error;
  }

  const itineraryId = itineraryIdInput ?? payment.itinerary_id;
  const currency = String(payment.currency ?? "USD").toUpperCase();

  const existing = await fetchExistingInvoice(paymentId, kind);
  if (existing) {
    const existingObjectPath = `invoices/${existing.number}.html`;
    const refreshedSignedPath = await createSignedUrl(existingObjectPath);
    await updateInvoiceStorage(existing.id, refreshedSignedPath);

    const fullExistingUrl = `${SUPABASE_URL}${refreshedSignedPath}`;
    logEvent({
      requestId,
      paymentId,
      itineraryId,
      kind,
      number: existing.number,
      storagePath: refreshedSignedPath,
      reused: true,
    });

    return jsonResponse({
      ok: true,
      invoice_id: existing.id,
      number: existing.number,
      signed_url: fullExistingUrl,
      reused: true,
    });
  }

  let totalCents = payment.amount_cents;
  if (kind === "credit_note") {
    const ledgerRefund = await fetchLatestRefundLedger(paymentId);
    if (ledgerRefund) {
      totalCents = ledgerRefund.amount_cents;
    }
  }
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    const error = new Error("invalid payment amount for invoice");
    (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
    throw error;
  }

  await ensureBucket();

  let number = kind === "invoice"
    ? await nextInvoiceNumber()
    : await resolveCreditNoteNumber(paymentId);
  if (kind === "credit_note" && !number) {
    number = generateCreditNoteNumber();
  }
  if (!number) {
    const error = new Error("failed to allocate invoice number");
    (error as { code?: string }).code = ERROR_CODES.UNKNOWN;
    throw error;
  }

  const objectPath = `invoices/${number}.html`;
  const html = renderInvoiceHtml({
    number,
    kind,
    currency,
    totalCents,
    providerRef: payment.provider_ref,
    itineraryId,
    createdAt: payment.created_at,
    status: payment.status,
  });

  await uploadInvoiceHtml(objectPath, html);
  const signedUrlPath = await createSignedUrl(objectPath);

  const insertResult = await insertInvoiceRecord({
    paymentId,
    itineraryId,
    kind,
    number,
    totalCents,
    currency,
    storagePath: signedUrlPath,
  });

  const fullSignedUrl = `${SUPABASE_URL}${signedUrlPath}`;

  logEvent({
    requestId,
    paymentId,
    itineraryId,
    kind,
    number,
    storagePath: signedUrlPath,
  });

  return jsonResponse({
    ok: true,
    invoice_id: insertResult?.id ?? null,
    number,
    signed_url: fullSignedUrl,
  });
}, { fn: "fin-invoice-generate", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

export { handler };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

async function fetchPayment(paymentId: string): Promise<PaymentRecord | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/payment.payments?id=eq.${paymentId}&select=id,amount_cents,currency,provider_ref,created_at,itinerary_id,status&limit=1`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Accept-Profile": "payment",
      },
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`failed to load payment: ${text}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) return null;
  const row = rows[0] as Record<string, unknown>;
  return {
    id: String(row.id),
    amount_cents: Number(row.amount_cents ?? 0),
    currency: String(row.currency ?? "USD"),
    provider_ref: row.provider_ref ? String(row.provider_ref) : undefined,
    created_at: row.created_at ? String(row.created_at) : undefined,
    itinerary_id: row.itinerary_id ? String(row.itinerary_id) : undefined,
    status: row.status ? String(row.status) : undefined,
  };
}

async function fetchLatestRefundLedger(paymentId: string) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/fin_latest_refund`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_payment_id: paymentId }),
    },
  );
  if (!response.ok) {
    return null;
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) return null;
  const row = rows[0] as Record<string, unknown>;
  return {
    amount_cents: Number(row.amount_cents ?? 0),
    currency: String(row.currency ?? "USD"),
  };
}

async function fetchExistingInvoice(paymentId: string, kind: string) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/fin_select_invoice`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_payment_id: paymentId,
        p_kind: kind,
      }),
    },
  );
  if (!response.ok) {
    return null;
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) return null;
  const row = rows[0] as Record<string, unknown>;
  if (!row.number || !row.id) return null;
  return {
    id: String(row.id),
    number: String(row.number),
    itinerary_id: row.itinerary_id ? String(row.itinerary_id) : undefined,
  };
}

async function ensureBucket() {
  if (bucketEnsured) return;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ name: "invoices", public: false }),
  });
  if (!response.ok && response.status !== 409) {
    const text = await response.text();
    throw new Error(`failed to ensure bucket: ${text}`);
  }
  bucketEnsured = true;
}

async function uploadInvoiceHtml(path: string, html: string) {
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${path}`,
    {
      method: "PUT",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "content-type": "text/html; charset=utf-8",
      },
      body: html,
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`failed to upload invoice html: ${text}`);
  }
}

async function createSignedUrl(path: string): Promise<string> {
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${path}`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 30 }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`failed to sign invoice: ${text}`);
  }
  const payload = await response.json() as {
    signedURL?: string;
    signedURLWithExpiration?: string;
  };
  if (!payload.signedURL) {
    throw new Error("signed URL missing");
  }
  return payload.signedURL;
}

async function insertInvoiceRecord(params: {
  paymentId: string;
  itineraryId?: string;
  kind: string;
  number: string;
  totalCents: number;
  currency: string;
  storagePath: string;
}) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/fin_insert_invoice`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_payment_id: params.paymentId,
        p_itinerary_id: params.itineraryId ?? null,
        p_kind: params.kind,
        p_number: params.number,
        p_total_cents: params.totalCents,
        p_currency: params.currency,
        p_storage_path: params.storagePath,
      }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`failed to insert invoice row: ${text}`);
  }
  const rows = await response.json();
  return Array.isArray(rows) && rows[0] ? rows[0] as { id: string } : null;
}

async function updateInvoiceStorage(invoiceId: string, signedUrlPath: string) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/fin_update_invoice_storage`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_invoice_id: invoiceId,
        p_storage_path: signedUrlPath,
      }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`failed to update invoice storage: ${text}`);
  }
}

async function nextInvoiceNumber(): Promise<string> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/next_invoice_number`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Accept-Profile": "fin",
        "Content-Profile": "fin",
      },
      body: JSON.stringify({}),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`failed to fetch next invoice number: ${text}`);
  }
  const payload = await response.json();
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object") {
    const values = Object.values(payload);
    if (values.length === 1 && typeof values[0] === "string") {
      return values[0];
    }
  }
  throw new Error("unexpected next_invoice_number response");
}

async function resolveCreditNoteNumber(
  paymentId: string,
): Promise<string | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/fin.invoices?payment_id=eq.${paymentId}&kind=eq.invoice&order=created_at.desc&select=number&limit=1`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Accept-Profile": "fin",
      },
    },
  );
  if (!response.ok) {
    return null;
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]?.number) return null;
  return `${String(rows[0].number)}-CN`;
}

function generateCreditNoteNumber(): string {
  const now = new Date();
  const today = `${now.getUTCFullYear()}${
    String(now.getUTCMonth() + 1).padStart(2, "0")
  }${String(now.getUTCDate()).padStart(2, "0")}`;
  const random = `${crypto.randomUUID().replace(/[^0-9]/g, "").slice(0, 4)}`;
  return `CN-${today}-${random}`;
}

function renderInvoiceHtml(input: {
  number: string;
  kind: string;
  currency: string;
  totalCents: number;
  providerRef?: string;
  itineraryId?: string;
  createdAt?: string;
  status?: string;
}): string {
  const amountMajor = (input.totalCents / 100).toFixed(2);
  const providerTail = input.providerRef
    ? input.providerRef.slice(-6).toUpperCase()
    : "UNKNOWN";
  const issuedAt = input.createdAt
    ? new Date(input.createdAt).toISOString()
    : new Date().toISOString();
  const title = input.kind === "credit_note" ? "Credit Note" : "Invoice";
  const buyerNote = "ecoTrips Merchant of Record";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${title} ${input.number}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; color: #1f2933; }
  h1 { font-size: 20px; margin-bottom: 8px; }
  .meta { margin-bottom: 16px; font-size: 14px; color: #52606d; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e4e7eb; }
  .total { font-size: 18px; font-weight: bold; }
  footer { margin-top: 32px; font-size: 12px; color: #9aa5b1; }
</style>
</head>
<body>
  <h1>${title} ${input.number}</h1>
  <div class="meta">
    <div>Issued at: ${issuedAt}</div>
    <div>Itinerary: ${input.itineraryId ?? "N/A"}</div>
    <div>Status: ${input.status ?? "recorded"}</div>
  </div>
  <section>
    <strong>${buyerNote}</strong>
    <p>Amount due: ${amountMajor} ${input.currency}</p>
  </section>
  <table>
    <tr><th>Description</th><th>Reference</th><th>Amount</th></tr>
    <tr>
      <td>${title}</td>
      <td>Ref tail: ${providerTail}</td>
      <td>${amountMajor} ${input.currency}</td>
    </tr>
  </table>
  <div class="total">Total: ${amountMajor} ${input.currency}</div>
  <footer>
    ecoTrips acts as Merchant of Record. Keep this ${title.toLowerCase()} for your records.
  </footer>
</body>
</html>`;
}

function logEvent(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "fin.invoice.generate",
      fn: "fin-invoice-generate",
      ...fields,
    }),
  );
}
