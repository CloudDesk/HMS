import { useAuth } from '../auth/useAuth';
import { PatientLoginPage } from '../pages/PatientLoginPage';
import { PatientPortalPage } from '../pages/PatientPortalPage';
import { PatientSignupPage } from '../pages/PatientSignupPage';
import { PatientWebsitePage } from '../pages/PatientWebsitePage';
import { navigate, useAppLocation } from './navigation';

export function AppRouter() {
  const { pathname } = useAppLocation();
  const { status } = useAuth();
  if (pathname === '/') return <PatientWebsitePage />;
  if (pathname === '/login') return <PatientLoginPage />;
  if (pathname === '/signup') return <PatientSignupPage />;
  if (pathname === '/portal') {
    if (status === 'loading') return <main className="patient-portal-state"><div className="portal-spinner" /><strong>Opening your portal…</strong></main>;
    if (status !== 'authenticated') { navigate(`/login?return=${encodeURIComponent(`${pathname}${location.search}`)}`, { replace: true }); return null; }
    return <PatientPortalPage />;
  }
  return <main className="patient-portal-state"><i className="ph ph-compass" /><strong>Page not found</strong><button onClick={() => navigate('/')} type="button">Return home</button></main>;
}
