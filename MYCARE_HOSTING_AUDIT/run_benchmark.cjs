const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://hms-api-atok.onrender.com';

const READ_ENDPOINTS = [
  { name: 'health', path: '/api/health', method: 'GET' },
  { name: 'health_db', path: '/api/health/db', method: 'GET' },
  { name: 'branches', path: '/api/patient-portal/public/branches', method: 'GET' },
  { name: 'departments', path: '/api/patient-portal/public/departments', method: 'GET' },
  { name: 'services', path: '/api/patient-portal/public/services', method: 'GET' },
  { name: 'doctors', path: '/api/patient-portal/public/doctors', method: 'GET' },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendRequest(endpointPath, method = 'GET', body = null, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const url = new URL(BASE_URL + endpointPath);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'User-Agent': 'MyCare-Benchmark-Agent/1.0',
        'Accept': 'application/json',
      },
      timeout: timeoutMs,
    };

    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const startTime = process.hrtime.bigint();
    let ttfb = null;
    let timedOut = false;

    const req = https.request(options, (res) => {
      const ttfbTime = process.hrtime.bigint();
      ttfb = Number(ttfbTime - startTime) / 1e6;

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1e6;
        resolve({
          statusCode: res.statusCode,
          duration,
          ttfb,
          timedOut: false,
          error: null,
          dataSize: Buffer.byteLength(data),
        });
      });
    });

    req.on('timeout', () => {
      timedOut = true;
      req.destroy();
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1e6;
      resolve({
        statusCode: 0,
        duration,
        ttfb: ttfb || duration,
        timedOut: true,
        error: 'TIMEOUT',
        dataSize: 0,
      });
    });

    req.on('error', (err) => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1e6;
      resolve({
        statusCode: 0,
        duration,
        ttfb: ttfb || duration,
        timedOut,
        error: err.message,
        dataSize: 0,
      });
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function calculateStats(results) {
  const durations = results.map((r) => r.duration).sort((a, b) => a - b);
  const ttfbs = results.map((r) => r.ttfb).filter((t) => t !== null).sort((a, b) => a - b);
  const successCount = results.filter((r) => r.statusCode >= 200 && r.statusCode < 300).length;
  const timeoutCount = results.filter((r) => r.timedOut).length;
  const errorCount = results.length - successCount;

  const min = durations[0] || 0;
  const max = durations[durations.length - 1] || 0;
  const sum = durations.reduce((acc, v) => acc + v, 0);
  const mean = durations.length ? sum / durations.length : 0;

  const getPercentile = (arr, p) => {
    if (!arr.length) return 0;
    const index = (p / 100) * (arr.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    if (upper >= arr.length) return arr[arr.length - 1];
    return arr[lower] * (1 - weight) + arr[upper] * weight;
  };

  const p50 = getPercentile(durations, 50);
  const p95 = getPercentile(durations, 95);
  const p99 = getPercentile(durations, 99);
  const ttfbP50 = getPercentile(ttfbs, 50);

  return {
    sampleSize: results.length,
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    mean: Number(mean.toFixed(2)),
    p50: Number(p50.toFixed(2)),
    p95: Number(p95.toFixed(2)),
    p99: Number(p99.toFixed(2)),
    ttfbP50: Number(ttfbP50.toFixed(2)),
    successRate: Number(((successCount / results.length) * 100).toFixed(2)),
    errorRate: Number(((errorCount / results.length) * 100).toFixed(2)),
    timeoutRate: Number(((timeoutCount / results.length) * 100).toFixed(2)),
    rawDurations: durations.map((d) => Number(d.toFixed(2))),
  };
}

async function runBenchmark() {
  console.log('================================================================');
  console.log('MYCARE — RENDER POST-OPTIMIZATION LATENCY BENCHMARK RUNNER');
  console.log('Target Base URL:', BASE_URL);
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================\n');

  // Step 1: Pre-warm connection & measure single cold/pre-warm ping
  console.log('[1/4] Checking server status & warming connection...');
  const preWarmRes = await sendRequest('/api/health');
  console.log(`Pre-warm status: ${preWarmRes.statusCode}, duration: ${preWarmRes.duration.toFixed(2)}ms\n`);

  const benchmarkReport = {
    metadata: {
      targetUrl: BASE_URL,
      timestamp: new Date().toISOString(),
      readSampleSizePerEndpoint: 25,
      otpSampleSize: 5,
    },
    endpoints: {},
  };

  // Step 2: Run Read Endpoints Benchmark (25 requests each)
  console.log('[2/4] Running warm read endpoints benchmark (25 requests per endpoint)...');
  for (const ep of READ_ENDPOINTS) {
    process.stdout.write(`Benchmarking ${ep.name} (${ep.path}) ... `);
    const runs = [];
    for (let i = 0; i < 25; i++) {
      const res = await sendRequest(ep.path, ep.method);
      runs.push(res);
      await sleep(100); // 100ms spacing between iterations
    }
    const stats = calculateStats(runs);
    benchmarkReport.endpoints[ep.name] = {
      path: ep.path,
      method: ep.method,
      ...stats,
    };
    console.log(`DONE: P50=${stats.p50}ms, P95=${stats.p95}ms, Mean=${stats.mean}ms (Success: ${stats.successRate}%)`);
  }

  // Step 3: Run Safe OTP Requests (5 requests with unique numbers to safely bypass cooldown per phone)
  console.log('\n[3/4] Running safe OTP request benchmark (5 safe requests)...');
  const otpRuns = [];
  const testPhones = [
    '+919822200021',
    '+919822200022',
    '+919822200023',
    '+919822200024',
    '+919822200025',
  ];

  for (let i = 0; i < 5; i++) {
    const phone = testPhones[i];
    const body = JSON.stringify({ phone });
    process.stdout.write(`OTP request #${i + 1} (${phone}) ... `);
    const res = await sendRequest('/api/patient-portal/otp/request', 'POST', body);
    otpRuns.push(res);
    console.log(`Status: ${res.statusCode}, Duration: ${res.duration.toFixed(2)}ms, TTFB: ${res.ttfb?.toFixed(2)}ms`);
    await sleep(250); // spacing
  }

  const otpStats = calculateStats(otpRuns);
  benchmarkReport.endpoints['otp_request'] = {
    path: '/api/patient-portal/otp/request',
    method: 'POST',
    ...otpStats,
  };

  // Step 4: Write output JSON
  console.log('\n[4/4] Writing benchmark results to JSON file...');
  const outputPath = path.join(__dirname, 'render-post-optimization-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(benchmarkReport, null, 2));
  console.log(`Saved results to ${outputPath}`);
  console.log('\nBenchmark completed successfully!');
}

runBenchmark().catch((err) => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
