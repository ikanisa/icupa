export interface PaymentProvider {
  readonly name: string;
  charge(amountCents: number, currency: string, metadata: Record<string, unknown>): Promise<{
    id: string;
    amountCents: number;
    currency: string;
    metadata: Record<string, unknown>;
    status: string;
  }>;
}

export interface SearchProvider {
  readonly name: string;
  indexDocument(index: string, document: Record<string, unknown>): Promise<void>;
}

export interface MessagingProvider {
  readonly name: string;
  sendMessage(destination: string, body: string, metadata?: Record<string, unknown>): Promise<void>;
}
