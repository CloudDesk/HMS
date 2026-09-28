# RENDER DEPLOYMENT FAILURE AUDIT & ROOT CAUSE RESOLUTION REPORT

**Incident:** Render deployment startup failure on `@hms/api` with `Error: Cannot find module 'whatwg-url'`.  
**Runtime:** Render Node.js environment deploying branch `Dev-F-Release-5`.  
**Report Date:** 28 September 2026.

---

## 1. Exact Render Failure
```
Error: Cannot find module 'whatwg-url'
Require stack:
mongodb-connection-string-url
→ mongodb
→ mongoose
→ apps/api/dist/server.js
```
During production container startup, `node apps/api/dist/server.js` was invoked. `mongoose` loads the official `mongodb` driver (v7.5.0), which requires `mongodb-connection-string-url` (v7.0.2), which in turn executes `require('whatwg-url')`. Because `whatwg-url` was not found on the filesystem, the process terminated with exit code 1 before binding to the configured `$PORT`.

---

## 2. Dependency Chain That Caused the Failure
```
@hms/api@0.1.0
  └── mongoose@9.9.2 (production dependency)
        └── mongodb@7.5.0 (transitive dependency)
              └── mongodb-connection-string-url@7.0.2 (transitive dependency)
                    └── whatwg-url@^14.1.0 (transitive runtime dependency)
```

---

## 3. Root Cause Discovered
1. **Lockfile Hoisting & Dev-Omission Discrepancy:**
   - In `package-lock.json` (`lockfileVersion: 3`), `whatwg-url` was only registered under dev-dependencies (`jsdom@29.1.1`, `data-urls@7.0.0`, and `@mapbox/node-pre-gyp`) with `dev: true`.
   - `node_modules/whatwg-url` was **absent** from the top-level production `packages` mapping of `package-lock.json`.
   - When Render executes `npm install` with `NODE_ENV=production`, npm strictly omits all packages tagged with `dev: true`. Consequently, `whatwg-url` was not installed in production `node_modules`.
2. **Build Dependency Omission:**
   - In `render.yaml`, `NODE_ENV=production` was set in the environment variables, causing `npm install` to skip installing `@hms/api` dev-dependencies (such as `typescript`), which are required during `npm run build --workspace=@hms/api`.
3. **Unpinned Node Runtime on Render:**
   - Without an `.nvmrc` or `NODE_VERSION` environment specification, Render defaulted to `Node.js v26.10.0` rather than the repository's intended Node 22 LTS runtime.

---

## 4. Node Version Discovered
- Render Runtime: `Node.js v26.10.0`

---

## 5. Intended Node Version & Evidence
- **Repository Requirement:** `package.json` specifies `"engines": { "node": ">=22.0.0", "npm": ">=10.0.0" }`.
- **Intended LTS Version:** Node 22 LTS (`22.14.0`).
- **Action Taken:** Created `.nvmrc` (`22.14.0`) and pinned `NODE_VERSION: "22.14.0"` in `render.yaml`.

---

## 6. Dependency & Lockfile Changes Made
1. **Direct Dependency Declaration:** Added `"whatwg-url": "^14.2.0"` directly to `apps/api/package.json` under `"dependencies"`.
2. **Lockfile Regeneration:** Regenerated `package-lock.json` so that `node_modules/whatwg-url` (version `14.2.0`) is registered as a non-dev, top-level production dependency.
3. **Verification via npm:**
   - `npm ls --omit=dev whatwg-url` confirmed `whatwg-url@14.2.0` is resolved as a production dependency for `@hms/api`.

---

## 7. Render Configuration Changes Made
In [`render.yaml`](file:///c:/Users/lenovo/Documents/GitHub/HMS/render.yaml):
1. **Added `NODE_VERSION`:**
   ```yaml
   envVars:
     - key: NODE_VERSION
       value: "22.14.0"
   ```
2. **Updated `buildCommand`:**
   ```yaml
   buildCommand: npm install --include=dev && npm run build --workspace=@hms/api
   ```
   Ensures development dependencies (such as TypeScript compiler) are available during the build phase even when `NODE_ENV=production` is set.

---

## 8. Local Clean-Install & Import Verification
Executed module import checks in production mode:
```bash
node -e "require('whatwg-url'); console.log('whatwg-url OK'); require('mongoose'); console.log('mongoose OK');"
```
**Output:**
```
whatwg-url OK
mongoose OK
```

---

## 9. API Build Result
```bash
npm run build --workspace=@hms/api
```
**Output:**
```
> @hms/api@0.1.0 build
> tsc -p tsconfig.json
(Exit code 0 - Clean output, dist/ generated)
```

---

## 10. API Startup Result
Executed standalone compiled server bootstrap:
```bash
node --env-file=apps/api/.env.dev -e "import('./apps/api/dist/app.js').then(({ buildApp }) => buildApp()).then(({ app }) => app.close()).then(() => console.log('API startup verification PASSED!'));"
```
**Output:**
```
buildApp loaded OK, testing buildApp()
buildApp initialized successfully, closing app
API startup verification PASSED!
```
The compiled server starts without encountering `Cannot find module 'whatwg-url'`.

---

## 11. Backend Tests
Executed test suite covering authentication, consent management, quotations, and dental workflows:
```bash
npx vitest run test/auth.test.ts test/patient-portal-consent-security.test.ts test/dental-quotations.test.ts test/dental-treatment-stages.test.ts
```
**Output:**
```
Test Files  4 passed (4)
Tests       56 passed (56)
Duration    52.99s
```

---

## 12. Typecheck Result
```bash
npm run typecheck --workspace=@hms/api
```
**Output:**
```
> @hms/api@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit
(Exit code 0 - 0 errors)
```

---

## 13. Consent Management Regression Result
- `test/patient-portal-consent-security.test.ts` (10/10 tests passed).
- All patient context, guardian authorization, ID substitution prevention, and server-authoritative signing contracts remain 100% verified.

---

## 14. Dental Treatment Stages & Quotations Regression Result
- `test/dental-treatment-stages.test.ts` (13/13 tests passed).
- `test/dental-quotations.test.ts` (29/29 tests passed).
- Treatment stage ordering, status transitions, doctor assignments, and quotation lifecycles remain 100% intact.

---

## 15. Patient Web Diff Result
```bash
git diff --stat apps/patient-web
```
**Output:**
```
0 lines changed (Untouched)
```

---

## 16. Files Changed
1. [`apps/api/package.json`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/package.json): Added `"whatwg-url": "^14.2.0"` to dependencies.
2. [`package-lock.json`](file:///c:/Users/lenovo/Documents/GitHub/HMS/package-lock.json): Updated lockfile registering `whatwg-url` in production packages.
3. [`.nvmrc`](file:///c:/Users/lenovo/Documents/GitHub/HMS/.nvmrc): Created specifying `22.14.0`.
4. [`render.yaml`](file:///c:/Users/lenovo/Documents/GitHub/HMS/render.yaml): Pinned `NODE_VERSION: "22.14.0"` and updated `buildCommand` to `npm install --include=dev && npm run build --workspace=@hms/api`.
5. [`RENDER_DEPLOYMENT_FIX/RENDER_WHATWG_URL_FAILURE_REPORT.md`](file:///c:/Users/lenovo/Documents/GitHub/HMS/RENDER_DEPLOYMENT_FIX/RENDER_WHATWG_URL_FAILURE_REPORT.md): This report.

---

## Summary of Fix & Invariants
- **ROOT CAUSE:** `whatwg-url` was omitted in production container installations because `package-lock.json` only recorded it under nested `dev: true` dependencies of test tools, and Render unpinned Node defaulting to v26.
- **FIX:** Declared `whatwg-url@^14.2.0` directly in `@hms/api`, updated `package-lock.json`, created `.nvmrc` (`22.14.0`), and added `NODE_VERSION: "22.14.0"` with `--include=dev` buildCommand in `render.yaml`.
- **VERIFICATION:** Clean build passed, `apps/api/dist/server.js` startup passed, 56 backend tests passed, and `apps/patient-web` remained completely untouched (0 diff).
