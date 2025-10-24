import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '2m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.SUPABASE_TEST_URL;
const SERVICE_ROLE = __ENV.SUPABASE_TEST_SERVICE_ROLE_KEY;

if (!BASE_URL || !SERVICE_ROLE) {
  throw new Error('SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY are required');
}

export default function () {
  const url = `${BASE_URL.replace(/\/$/, '')}/functions/v1/bff-quote/health`;
  const res = http.get(url, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'body ok flag': (r) => r.json('ok') === true,
  });

  sleep(1);
}
