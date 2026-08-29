# M-009 Staff Route Code Splitting Gap Note

## Scope

M-009 applies route-level code splitting to the staff application only. It does not refactor pages, routing semantics, authentication, permissions, APIs, or backend code.

## Existing Architecture Reused

- `AppRouter.tsx` is a custom pathname-based router using `useAppLocation`.
- Public routes are selected before the protected application shell.
- Protected routes retain `ProtectedRoute`, permission evaluation through `canAccessRoute`, and `DashboardLayout`.
- `LoadingState` is the existing shared session/loading presentation.
- Vite provides native dynamic-import chunk generation; no bundle-analysis dependency is installed.

## Gap

The router statically imported every implemented page module. The production build therefore emitted a single 1,537.70 kB JavaScript bundle (345.20 kB gzip), and Vite warned that dynamic imports should be used to split the application.

## Intended Change

- Convert route-owned page imports to `React.lazy()` dynamic imports.
- Keep shared router, guard, layout, loading, 404, access-denied, navigation, and coming-soon components eager.
- Add one shared `Suspense` fallback for protected page content and equivalent public-route fallbacks.
- Preserve every existing pathname, alias, title, breadcrumb, permission check, redirect, and page component.

## Files

- `apps/web/src/routing/AppRouter.tsx`
- `apps/web/src/routing/AppRouter.test.tsx`
- This gap note and the matching verification document.

