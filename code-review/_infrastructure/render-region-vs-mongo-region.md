# Infrastructure finding: API deployment region vs. MongoDB region

**Found:** 2026-10-06, while closing the load-test gap flagged in the `branches`, `departments`, and `auth-rbac` module reviews.
**Status: confirmed via live measurement against the real SIT database; one fact (actual deployed Render region) still needs a 10-second confirmation in the Render dashboard — everything else here is measured, not inferred.**

## The measurement

Using the real SIT MongoDB connection (`apps/api/.env.sit`, a `mongodb+srv://` Atlas connection), read-only, zero writes:

| Probe | n | p50 | p65 | p90 | max | mean |
|---|---|---|---|---|---|---|
| `admin().ping()` — raw network round trip, no query | 30 | 25.30ms | 25.87ms | 30.43ms | 36.94ms | 26.24ms |
| `Branch.find({}).limit(5)` — real indexed read | 20 | 26.38ms | 26.72ms | 30.44ms | 39.33ms | 27.41ms |

**The query barely costs more than the bare ping (26.4ms vs 25.3ms).** That ~1ms delta is the actual work MongoDB does (index seek + document fetch). The other ~25ms is pure network round-trip time between wherever this process ran and the Mumbai Atlas cluster. This confirms, with real numbers, the structural claim made in every module review so far: **round-trip count, not query cost, is what dominates latency** — each additional sequential `await someModel.find(...)` in a request handler adds another ~25-30ms (from this measurement point), not microseconds.

## The infrastructure gap

`render.yaml` defines the `hms-api` web service with no `region` key:

```yaml
services:
  - type: web
    name: hms-api
    runtime: node
    plan: free
    # no `region:` entry anywhere in the file
```

Render's documented default region when `region` is omitted is **Oregon (US West)**. Render's available regions as of this writing are Oregon, Ohio, Virginia, Frankfurt, and Singapore — Singapore is the closest offered region to Mumbai; there is no Render region in India itself.

**This one fact needs your confirmation, not mine**: open the service in the Render dashboard and check its actual region (shown on the service's Settings page). I can't see that directly — I can only see that the committed `render.yaml` never pins one, which means whatever region the service is *actually* running in today was set either by Render's default at creation time or by a manual dashboard change that was never reflected back into this file. Either way, the file as committed does not guarantee — or even document — where the API actually runs relative to its database.

## Why this matters more than any single code fix in this review series

If the API is in fact running in Oregon (or any non-Singapore Render region) against a Mumbai-region Atlas cluster, typical Oregon↔Mumbai round-trip time over the public internet is commonly in the **200-300ms range** — roughly 8-12x worse than what I measured from this sandbox to the same database. Every round-trip count already documented in this review series gets multiplied by whatever that real number turns out to be:

| Endpoint (from earlier reviews) | Sequential DB round trips | At ~25ms/RT (this measurement) | At ~250ms/RT (plausible Oregon↔Mumbai) |
|---|---|---|---|
| `GET /api/branches` | 6 | ~150ms | ~1,500ms |
| `POST /api/branches` | 7 | ~175ms | ~1,750ms |
| `PATCH /api/branches/:id` (worst case) | 8 | ~200ms | ~2,000ms |
| `POST /api/auth/login` | 11 | ~275ms | ~2,750ms |

These are back-of-envelope multiplications, not a new measurement of the production path itself — but they explain, with a real mechanism, why a user-reported "the app feels slow" complaint could have almost nothing to do with any of the code-level findings in this series and everything to do with where the service happens to be deployed.

## Recommendation

1. **Confirm the actual current Render region** for `hms-api` in the dashboard (10 seconds).
2. If it is not already Singapore (or, if available to you, a region closer to Mumbai than Oregon), **set `region: singapore` explicitly in `render.yaml`** and redeploy — this is a single-line infrastructure change with no code risk, and based on this measurement, it is very plausibly a bigger latency win than every code-level round-trip-reduction finding in this review series *combined*.
3. Once moved, re-run this same read-only probe (or a proper k6 test) from a Singapore-region client to get a realistic picture of the *remaining* gap — Singapore↔Mumbai is still a real network hop (commonly 30-60ms round trip), not zero, so the code-level round-trip-count findings (auth/permission caching, redundant user refetches, etc.) still matter and should still be fixed — they just stop being the dominant cost once the region mismatch (if confirmed) is fixed.
4. This is also exactly the reason the `branches` review's §6 flagged "confirm API deployment region vs. MongoDB Atlas cluster region" as a required open item before trusting any latency interpretation — that flag was raised before this measurement existed, and this finding is the concrete follow-through on it.

## What would make this fully conclusive

A proper k6 (or equivalent) load test run *from inside the actual deployed Render service's region* (not from this sandbox, which has its own unknown network position) against the real SIT or production API would give the real number directly, superseding the back-of-envelope multiplication table above. That's the natural next step once region is confirmed/fixed, and ties directly into the `benchmark/baseline.js` harness already in this repo (currently not covering `branches`/`auth` at all — also flagged in earlier reviews).
