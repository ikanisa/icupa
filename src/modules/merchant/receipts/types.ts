export interface MerchantReceiptSummary {
  totals?: Record<string, unknown> | null;
  providerReference?: string | null;
  [key: string]: unknown;
}

export interface MerchantReceiptIntegrationNotes {
  steps?: unknown[];
  [key: string]: unknown;
}

export interface MerchantReceipt {
  id: string;
  orderId: string;
  fiscalId: string | null;
  region: string;
  url: string | null;
  createdAt: string | null;
  summary: MerchantReceiptSummary | null;
  integrationNotes: MerchantReceiptIntegrationNotes | null;
}
