import type { PaymentProvider } from './types.js';
import { env } from '../../config/env.js';

class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  async charge(amountCents: number, currency: string, metadata: Record<string, unknown>) {
    return { id: `mock_${Date.now()}`, amountCents, currency, metadata, status: 'succeeded' };
  }
}

class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  async charge(amountCents: number, currency: string, metadata: Record<string, unknown>) {
    throw new Error('Stripe provider not configured');
  }
}

const providers: Record<string, PaymentProvider> = {
  mock: new MockPaymentProvider(),
  stripe: new StripePaymentProvider()
};

export const paymentProvider = providers[env.PAYMENT_PROVIDER] ?? providers.mock;
