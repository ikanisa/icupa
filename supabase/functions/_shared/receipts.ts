export type RegionCode = "RW" | "EU";

export interface ReceiptLineItemInput {
  name: string;
  quantity: number;
  unitPriceCents: number;
}

export interface ReceiptContextInput {
  orderId: string;
  paymentId: string;
  tenantId: string;
  locationId: string;
  currency: string;
  subtotalCents: number;
  taxCents: number;
  serviceCents: number;
  totalCents: number;
  providerRef?: string | null;
  region: RegionCode;
  lineItems: ReceiptLineItemInput[];
}

export interface SimulatedReceiptSummary {
  fiscalId: string;
  issuedAtIso: string;
  region: RegionCode;
  url: string;
  qrCodeData?: string;
  signaturePlaceholder?: string;
  totals: {
    subtotalCents: number;
    taxCents: number;
    serviceCents: number;
    totalCents: number;
    currency: string;
  };
  lineItems: Array<ReceiptLineItemInput & { totalCents: number }>;
  providerReference?: string | null;
}

export interface SimulatedReceiptResult {
  summary: SimulatedReceiptSummary;
  payload: Record<string, unknown>;
  integrationNotes: {
    steps: string[];
    retrySeconds: number[];
    auditLog: string;
    escalationContact: string;
  };
}

const RRA_EBM_ENDPOINT = Deno.env.get("RRA_EBM_ENDPOINT") ?? "";
const RRA_EBM_API_KEY = Deno.env.get("RRA_EBM_API_KEY") ?? "";
const RRA_EBM_USERNAME = Deno.env.get("RRA_EBM_USERNAME") ?? "";
const RRA_EBM_PASSWORD = Deno.env.get("RRA_EBM_PASSWORD") ?? "";

const MALTA_FISCAL_ENDPOINT = Deno.env.get("MALTA_FISCAL_ENDPOINT") ?? "";
const MALTA_FISCAL_API_KEY = Deno.env.get("MALTA_FISCAL_API_KEY") ?? "";

function buildAuthHeaders(apiKey: string, username: string, password: string) {
  if (apiKey) {
    return { Authorization: `Bearer ${apiKey}` };
  }
  if (username && password) {
    return { Authorization: `Basic ${btoa(`${username}:${password}`)}` };
  }
  return {} as Record<string, string>;
}

const toLineItemPayload = (items: ReceiptLineItemInput[]) =>
  items.map((item) => ({
    ...item,
    totalCents: Math.max(0, Math.floor(item.unitPriceCents)) * Math.max(0, Math.floor(item.quantity)),
  }));

const buildReceiptUrl = (region: RegionCode, fiscalId: string) =>
  `https://receipts.icupa.dev/${region.toLowerCase()}/${encodeURIComponent(fiscalId)}`;

export function simulateRwandaReceipt(context: ReceiptContextInput): SimulatedReceiptResult {
  const issuedAtIso = new Date().toISOString();
  const invoiceNumber = `EBM-${context.orderId.slice(0, 8).toUpperCase()}-${issuedAtIso.slice(0, 10)}`;
  const qrCodeData = [
    "ICUPA",
    "RRA",
    invoiceNumber,
    (context.totalCents / 100).toFixed(2),
    context.currency,
    context.orderId,
  ].join("|");

  const lineItems = toLineItemPayload(context.lineItems);
  const summary: SimulatedReceiptSummary = {
    fiscalId: invoiceNumber,
    issuedAtIso,
    region: context.region,
    url: buildReceiptUrl(context.region, invoiceNumber),
    qrCodeData,
    totals: {
      subtotalCents: context.subtotalCents,
      taxCents: context.taxCents,
      serviceCents: context.serviceCents,
      totalCents: context.totalCents,
      currency: context.currency,
    },
    lineItems,
    providerReference: context.providerRef ?? null,
  };

  const payload = {
    schema: "rra_ebm_2_1_simulated",
    invoice_number: invoiceNumber,
    issued_at: issuedAtIso,
    totals: summary.totals,
    line_items: lineItems,
    qr_code_data: qrCodeData,
    links: {
      pdf: `${summary.url}.pdf`,
      xml: `${summary.url}.xml`,
    },
    metadata: {
      order_id: context.orderId,
      payment_id: context.paymentId,
      tenant_id: context.tenantId,
      location_id: context.locationId,
      provider_reference: context.providerRef ?? null,
    },
  } satisfies Record<string, unknown>;

  return {
    summary,
    payload,
    integrationNotes: {
      steps: [
        "Submit payload to the official RRA EBM 2.1 endpoint using the merchant certificate.",
        "Log the fiscal invoice ID and response payload in the audit trail.",
        "Surface the QR code and invoice number to staff and diners immediately.",
      ],
      retrySeconds: [30, 90, 180],
      auditLog: "Persist EBM invoice number, submission payload, and response for 5 years per RRA guidance.",
      escalationContact: "RRA EBM Service Desk",
    },
  } satisfies SimulatedReceiptResult;
}

export function simulateMaltaReceipt(context: ReceiptContextInput): SimulatedReceiptResult {
  const issuedAtIso = new Date().toISOString();
  const randomSegment = crypto.randomUUID().slice(0, 6).toUpperCase();
  const receiptNumber = `MT-${context.orderId.slice(0, 6).toUpperCase()}-${randomSegment}`;
  const lineItems = toLineItemPayload(context.lineItems);
  const signaturePlaceholder = `SIGNATURE-PENDING-${receiptNumber}`;

  const summary: SimulatedReceiptSummary = {
    fiscalId: receiptNumber,
    issuedAtIso,
    region: context.region,
    url: buildReceiptUrl(context.region, receiptNumber),
    signaturePlaceholder,
    totals: {
      subtotalCents: context.subtotalCents,
      taxCents: context.taxCents,
      serviceCents: context.serviceCents,
      totalCents: context.totalCents,
      currency: context.currency,
    },
    lineItems,
    providerReference: context.providerRef ?? null,
  };

  const payload = {
    schema: "malta_fiscal_receipt_simulated",
    receipt_number: receiptNumber,
    issued_at: issuedAtIso,
    totals: summary.totals,
    line_items: lineItems,
    signature: signaturePlaceholder,
    metadata: {
      order_id: context.orderId,
      payment_id: context.paymentId,
      tenant_id: context.tenantId,
      location_id: context.locationId,
      provider_reference: context.providerRef ?? null,
    },
    links: {
      pdf: `${summary.url}.pdf`,
    },
  } satisfies Record<string, unknown>;

  return {
    summary,
    payload,
    integrationNotes: {
      steps: [
        "Send receipt payload to the certified fiscal printer/service with tenant credentials.",
        "Capture the signed fiscal hash and printer acknowledgement in the audit trail.",
        "Provide staff with a reprint flow including signature and sequential receipt number.",
      ],
      retrySeconds: [20, 60, 180],
      auditLog: "Store Malta fiscal receipt number, payload, and printer response for the statutory retention period.",
      escalationContact: "Commissioner for Revenue Helpdesk",
    },
  } satisfies SimulatedReceiptResult;
}

export async function issueRwandaFiscalReceipt(context: ReceiptContextInput): Promise<SimulatedReceiptResult> {
  if (!RRA_EBM_ENDPOINT) {
    return simulateRwandaReceipt(context);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...buildAuthHeaders(RRA_EBM_API_KEY, RRA_EBM_USERNAME, RRA_EBM_PASSWORD),
  };

  const response = await fetch(RRA_EBM_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({
      order_id: context.orderId,
      payment_id: context.paymentId,
      total_cents: context.totalCents,
      currency: context.currency,
      subtotal_cents: context.subtotalCents,
      tax_cents: context.taxCents,
      service_cents: context.serviceCents,
      provider_ref: context.providerRef,
      line_items: context.lineItems,
      tenant_id: context.tenantId,
      location_id: context.locationId,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RRA EBM endpoint error (${response.status}): ${text}`);
  }

  const payload = await response.json() as Record<string, unknown>;
  const summary: SimulatedReceiptSummary = {
    fiscalId: (payload["invoice_number"] as string) ?? (payload["fiscal_id"] as string) ?? `EBM-${context.orderId}`,
    issuedAtIso: (payload["issued_at"] as string) ?? new Date().toISOString(),
    region: "RW",
    url: (payload["receipt_url"] as string) ?? buildReceiptUrl("RW", context.orderId),
    qrCodeData: payload["qr_code"] as string | undefined,
    signaturePlaceholder: undefined,
    totals: {
      subtotalCents: context.subtotalCents,
      taxCents: context.taxCents,
      serviceCents: context.serviceCents,
      totalCents: context.totalCents,
      currency: context.currency,
    },
    lineItems: toLineItemPayload(context.lineItems),
    providerReference: context.providerRef ?? null,
  };

  return {
    summary,
    payload,
    integrationNotes: {
      steps: ["Receipt issued via live RRA EBM API"],
      retrySeconds: [30, 90, 180],
      auditLog: "Persist API request/response as provided by RRA EBM.",
      escalationContact: "RRA EBM Service Desk",
    },
  };
}

export async function issueMaltaFiscalReceipt(context: ReceiptContextInput): Promise<SimulatedReceiptResult> {
  if (!MALTA_FISCAL_ENDPOINT) {
    return simulateMaltaReceipt(context);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (MALTA_FISCAL_API_KEY) {
    headers.Authorization = `Bearer ${MALTA_FISCAL_API_KEY}`;
  }

  const response = await fetch(MALTA_FISCAL_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({
      order_id: context.orderId,
      payment_id: context.paymentId,
      tenant_id: context.tenantId,
      location_id: context.locationId,
      totals: {
        subtotal_cents: context.subtotalCents,
        tax_cents: context.taxCents,
        service_cents: context.serviceCents,
        total_cents: context.totalCents,
        currency: context.currency,
      },
      line_items: context.lineItems,
      provider_ref: context.providerRef,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Malta fiscal endpoint error (${response.status}): ${text}`);
  }

  const payload = await response.json() as Record<string, unknown>;
  const summary: SimulatedReceiptSummary = {
    fiscalId: (payload["receipt_number"] as string) ?? `MT-${context.orderId}`,
    issuedAtIso: (payload["issued_at"] as string) ?? new Date().toISOString(),
    region: "EU",
    url: (payload["receipt_url"] as string) ?? buildReceiptUrl("EU", context.orderId),
    signaturePlaceholder: (payload["signature"] as string) ?? undefined,
    totals: {
      subtotalCents: context.subtotalCents,
      taxCents: context.taxCents,
      serviceCents: context.serviceCents,
      totalCents: context.totalCents,
      currency: context.currency,
    },
    lineItems: toLineItemPayload(context.lineItems),
    providerReference: context.providerRef ?? null,
  };

  return {
    summary,
    payload,
    integrationNotes: {
      steps: ["Receipt issued via Malta fiscal endpoint"],
      retrySeconds: [20, 60, 180],
      auditLog: "Persist signed fiscal payload as provided by Malta service.",
      escalationContact: "Commissioner for Revenue Helpdesk",
    },
  };
}
