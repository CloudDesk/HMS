import { lazy, Suspense } from 'react';
import { PatientWebsitePage } from '../pages/PatientWebsitePage';
import { ProtectedRoute } from './ProtectedRoute';
import { navigate, useAppLocation } from './navigation';

const PatientLoginPage = lazy(() =>
  import('../pages/PatientLoginPage').then((m) => ({ default: m.PatientLoginPage }))
);
const PatientSignupPage = lazy(() =>
  import('../pages/PatientSignupPage').then((m) => ({ default: m.PatientSignupPage }))
);
const PatientPortalPage = lazy(() =>
  import('../pages/PatientPortalPage').then((m) => ({ default: m.PatientPortalPage }))
);

function RouteLoadingFallback() {
  return (
    <main className="patient-portal-state">
      <div className="portal-spinner" />
      <strong>Loading…</strong>
    </main>
  );
}

export function AppRouter() {
  const { pathname } = useAppLocation();

  if (pathname === '/') {
    return <PatientWebsitePage />;
  }

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      {pathname === '/login' ? (
        <PatientLoginPage />
      ) : pathname === '/signup' ? (
        <PatientSignupPage />
      ) : pathname === '/portal' ? (
        <ProtectedRoute>
          <PatientPortalPage />
        </ProtectedRoute>
      ) : (
        <main className="patient-portal-state">
          <i className="ph ph-compass" />
          <strong>Page not found</strong>
          <button onClick={() => navigate('/')} type="button">
            Return home
          </button>
        </main>
      )}
    </Suspense>
  );
}
