import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.ICUPA_BASE_URL ?? 'https://staging.icupa.example';
const SIGNATURE = __ENV.ICUPA_WEBHOOK_SIGNATURE ?? 'test-signature-placeholder';

export const options = {
  thresholds: {
    http_req_failed: ['rate<0.001'],
    http_req_duration: ['p(95)<400'],
  },
  scenarios: {
    payments_webhooks: {
      executor: 'constant-arrival-rate',
      duration: '15m',
      rate: 40,
      timeUnit: '1s',
      preAllocatedVUs: 60,
    },
  },
};

function buildStripePayload() {
  return JSON.stringify({
    id: 'evt_test_phase10',
    type: 'payment_intent.succeeded',
    created: Date.now(),
    data: {
      object: {
        id: 'pi_phase10',
        amount_received: 4200,
        currency: 'eur',
        metadata: { tenant_id: 'phase10-tenant', order_id: 'order-phase10' },
      },
    },
  });
}

export default function dispatchWebhook() {
  const res = http.post(`${BASE_URL}/functions/v1/payments/stripe/webhook`, buildStripePayload(), {
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': SIGNATURE,
    },
  });

  check(res, {
    'status is 200/202': (r) => r.status === 200 || r.status === 202,
  });

  sleep(0.5);
}
