# HMS Performance Benchmarking

This directory contains minimal baseline performance measurements to resolve Finding 8.

## Prerequisites

- Install [k6](https://k6.io/docs/get-started/installation/)

## Running the Baseline Benchmark

The benchmark measures the highest-traffic list endpoints:
1. Emergency encounters queue (`GET /api/emergency/encounters`)
2. Surgery bookings list (`GET /api/surgery/bookings`)
3. Inpatient admission requests (`GET /api/admissions/requests`)

### Environment Variables

- `K6_BASE_URL`: The URL of the API server (default: `http://localhost:3000`)
- `K6_AUTH_TOKEN`: A valid JWT or authentication token for a user with sufficient permissions to view the above workflows.
- `K6_BRANCH_ID`: A valid `branch_id` to query (default: `1`).

### Example Command

```bash
K6_BASE_URL=http://localhost:3000 K6_AUTH_TOKEN="your_jwt_here" K6_BRANCH_ID="branch_id_here" npm run benchmark
```

### Metrics Explained

- **p50**: The median response time (50% of requests are faster than this).
- **p95**: The 95th percentile response time (95% of requests are faster than this).
- **p99**: The 99th percentile response time.
- **http_reqs**: Total requests and request rate (throughput).
- **http_req_failed**: Error rate.

### MongoDB `executionStats` Limitation

Safe, isolated `.explain('executionStats')` measurements for production queries could not be reliably implemented without invasive changes to the application's runtime or coupling to the complex MongoDB schema initialization. Capturing query-level DB execution stats without polluting the codebase remains a limitation.

### Warning
Do **NOT** point this benchmark at production without explicit approval. The script runs concurrent requests which could degrade production performance.
