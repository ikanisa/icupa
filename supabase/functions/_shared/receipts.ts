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
