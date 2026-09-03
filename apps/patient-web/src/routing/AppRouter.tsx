import { lazy, Suspense, useEffect } from 'react';
import { useAuth } from '../auth/useAuth';
import { navigate, useAppLocation } from './navigation';

const PatientWebsitePage = lazy(() => import('../pages/PatientWebsitePage').then((m) => ({ default: m.PatientWebsitePage })));
const PatientLoginPage = lazy(() => import('../pages/PatientLoginPage').then((m) => ({ default: m.PatientLoginPage })));
const PatientSignupPage = lazy(() => import('../pages/PatientSignupPage').then((m) => ({ default: m.PatientSignupPage })));
const PatientPortalPage = lazy(() => import('../pages/PatientPortalPage').then((m) => ({ default: m.PatientPortalPage })));

function RouteFallback({ label = 'page' }: { label?: string }) {
  return (
    <main className="patient-portal-state" role="status" aria-busy="true" aria-label={`Loading ${label}`}>
      <div className="portal-spinner" />
      <strong>Loading {label}…</strong>
    </main>
  );
}

export function AppRouter() {
  const { pathname, search } = useAppLocation();
  const { status } = useAuth();

  useEffect(() => {
    if (pathname === '/portal' && status === 'unauthenticated') {
      navigate(`/login?return=${encodeURIComponent(`${pathname}${search}`)}`, { replace: true });
    }
  }, [pathname, search, status]);

  return (
    <Suspense fallback={<RouteFallback label="view" />}>
      {pathname === '/' && <PatientWebsitePage />}
      {pathname === '/login' && <PatientLoginPage />}
      {pathname === '/signup' && <PatientSignupPage />}
      {pathname === '/portal' && (
        status === 'loading' ? (
          <main className="patient-portal-state" role="status" aria-busy="true">
            <div className="portal-spinner" />
            <strong>Opening your portal…</strong>
          </main>
        ) : status === 'authenticated' ? (
          <PatientPortalPage />
        ) : null
      )}
      {pathname !== '/' && pathname !== '/login' && pathname !== '/signup' && pathname !== '/portal' && (
        <main className="patient-portal-state">
          <i className="ph ph-compass" />
          <strong>Page not found</strong>
          <button onClick={() => navigate('/')} type="button">Return home</button>
        </main>
      )}
    </Suspense>
  );
}
