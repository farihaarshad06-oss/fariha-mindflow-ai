import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.API_BASE_URL ?? 'http://localhost:3333/api';

export const options = {
  vus: 5,
  duration: '20s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const payload = JSON.stringify({
    title: 'Performance lecture',
    consentAcknowledged: true,
  });
  const res = http.post(`${BASE_URL}/lectures`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, {
    'lecture creation responds': (r) => r.status < 500,
  });
  sleep(1);
}
