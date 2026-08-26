import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1, // 1 Virtual User for baseline
  duration: '10s',
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
  },
};

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.K6_AUTH_TOKEN;
const BRANCH_ID = __ENV.K6_BRANCH_ID || '1';

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
    },
  };

  const requests = [
    {
      method: 'GET',
      url: `${BASE_URL}/api/emergency/encounters?branch_id=${BRANCH_ID}&page=1&limit=50`,
      params,
    },
    {
      method: 'GET',
      url: `${BASE_URL}/api/surgery/bookings?branch_id=${BRANCH_ID}&page=1&limit=50`,
      params,
    },
    {
      method: 'GET',
      url: `${BASE_URL}/api/admissions/requests?branch_id=${BRANCH_ID}&page=1&limit=50`,
      params,
    }
  ];

  const responses = http.batch(requests);

  responses.forEach((res) => {
    check(res, {
      'status is 200 or 401/403 (auth missing)': (r) => [200, 401, 403].includes(r.status),
    });
  });

  sleep(1);
}
