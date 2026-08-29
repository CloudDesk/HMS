# M-009 Staff Route Code Splitting Verification

## Implemented

- Converted 51 route modules to dynamic imports: 50 `*Page` modules plus `DashboardShell`.
- Kept `ComingSoonPage`, inline not-found/access-denied states, guards, layout, and loading UI eager.
- Added `Suspense` around public lazy routes and inside the protected dashboard layout.
- Reused `LoadingState` with route-specific loading text.

## Route Behavior

All existing pathname checks, aliases, route parameters/query handling, titles, breadcrumbs, permissions, authentication checks, redirects, 404 behavior, and coming-soon behavior are unchanged. Permission denial replaces the lazy element before it is rendered, so denied routes do not trigger their page import.

## Production Bundle Comparison

Baseline production build:

- JavaScript chunks: 1.
- Main JavaScript: 1,537.70 kB, 345.20 kB gzip.
- Vite large-chunk warning present.

M-009 production build:

- JavaScript chunks: 112 total, including shared dependency chunks.
- Route chunks: 51, including 50 named page chunks.
- Initial HTML loads the 289.05 kB main chunk and preloads the 8.43 kB JSX runtime chunk.
- Main JavaScript reduction: 1,248.65 kB (81.2%) before gzip.
- Main gzip reduction: 258.48 kB (74.9%); the runtime preload adds 3.21 kB gzip.
- Total emitted JavaScript is 1,582,785 bytes; code is deferred rather than removed.
- Vite's greater-than-500 kB warning is no longer emitted.

Representative separate route chunks:

- `OpdVisitPage`: 75.63 kB, 15.43 kB gzip.
- `PatientProfilePage`: 67.14 kB, 13.18 kB gzip.
- `EmergencyWorkspacePage`: 64.66 kB, 11.83 kB gzip.
- `SurgeryWorkspacePage`: 57.16 kB, 11.13 kB gzip.
- `InpatientWorkspacePage`: 42.73 kB, 8.69 kB gzip.

## Automated Validation

- `npm.cmd exec vitest -- run src/routing/AppRouter.test.tsx`: PASS, 2 tests.
  - Shared loading fallback renders before a representative lazy OPD route resolves.
  - The OPD page renders after the lazy module resolves.
  - Unauthenticated protected access retains the encoded login redirect.
- `npm.cmd run typecheck --workspace=@hms/web`: PASS.
- `npm.cmd run build --workspace=@hms/web`: PASS.
- `npm.cmd exec eslint -- src/routing/AppRouter.tsx src/routing/AppRouter.test.tsx`: PASS.

## Remaining Limitation

This pass provides route-level splitting only. Shared dependencies are still factored by Vite, and route chunks may request common chunks when navigated to. Page-internal splitting, prefetch policy, and manual vendor chunking are outside M-009.

