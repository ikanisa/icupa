import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.ICUPA_BASE_URL ?? 'https://staging.icupa.example';
const SESSION_TOKENS = (__ENV.ICUPA_QR_TOKENS ?? '').split(',').filter(Boolean);

export const options = {
  thresholds: {
    http_req_failed: ['rate<0.001'],
    http_req_duration: ['p(95)<250'],
  },
  scenarios: {
    create_table_session: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '10m', target: 60 },
        { duration: '3m', target: 0 },
      ],
    },
  },
};

export default function createTableSession() {
  const token = SESSION_TOKENS.length
    ? SESSION_TOKENS[Math.floor(Math.random() * SESSION_TOKENS.length)]
    : 'signed-placeholder-token';

  const res = http.post(`${BASE_URL}/functions/v1/create_table_session`, JSON.stringify({ payload: token }), {
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Source': 'phase10-k6',
    },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has session id': (r) => (r.json('table_session_id') ?? '').length > 0,
  });

  sleep(1);
}
