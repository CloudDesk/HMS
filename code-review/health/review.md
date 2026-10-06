# Module Review: `health`

**Reviewed:** 2026-10-06
**Scope:** `apps/api/src/modules/health/health.routes.ts` (43 lines, the entire module) plus `apps/api/src/database/health.ts`. Static code review.

---

## 1. Executive summary

This module is exactly two liveness/readiness endpoints — `GET /api/health` (static service identity) and `GET /api/health/db` (database connectivity). There is effectively nothing to find here beyond one trivial, low-severity observation.

| Severity | Count | Theme |
|---|---|---|
| 🟢 Low | 1 | `/api/health/db` reveals the MongoDB database name to any unauthenticated caller |

---

## 2. What's correct (keep doing this)

- **Both endpoints are correctly unauthenticated** — a load balancer or uptime monitor needs to reach these without credentials, and gating them behind auth would defeat their purpose. This is the right call, not an oversight.
- **`/api/health/db` reflects real connection state** (`mongoose.connection.readyState === 1`) rather than a hardcoded "ok," so it actually detects a genuine database outage rather than just confirming the Node process is alive.

---

## 3. Findings

### 3.1 🟢 LOW — Database name disclosed to unauthenticated callers

**Where:** `database/health.ts`, returned via `GET /api/health/db`

```ts
const dbName = mongoose.connection.db ? mongoose.connection.db.databaseName : 'unknown';
return { connected: isConnected, database: dbName };
```

Any unauthenticated caller can learn the MongoDB database name (e.g., `hms-prod`). This is low-value reconnaissance information and extremely common practice for health endpoints — not treated as a real vulnerability by most security guidance — but it's a small, free thing to remove if this endpoint is ever reachable directly from the public internet rather than only by internal monitoring infrastructure.

**Recommended fix:** low priority; if addressed, return only `{ status }` publicly and log the database name server-side instead of echoing it in the response body.

---

## 4-9. (Not applicable)

No validation, index, round-trip, load-testing, or scalability findings apply to a module this small and this read-only.

---

## 10. Verdict

**Production-ready as-is.** The one observation is cosmetic.
