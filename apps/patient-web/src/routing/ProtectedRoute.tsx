import { useEffect, type PropsWithChildren } from 'react';
import { useAuth } from '../auth/useAuth';
import { navigate, useAppLocation } from './navigation';

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { status } = useAuth();
  const location = useAppLocation();

  useEffect(() => {
    if (status === 'unauthenticated' || status === 'session-expired') {
      const returnUrl = encodeURIComponent(`${location.pathname}${location.search}`);
      const params = new URLSearchParams({
        return: returnUrl,
        ...(status === 'session-expired' ? { reason: 'session-expired' } : {}),
      });
      navigate(`/login?${params.toString()}`, { replace: true });
    }
  }, [location.pathname, location.search, status]);

  if (status === 'loading') {
    return (
      <main className="patient-portal-state">
        <div className="portal-spinner" />
        <strong>Opening your portal…</strong>
      </main>
    );
  }

  if (status !== 'authenticated') {
    return (
      <main className="patient-portal-state">
        <div className="portal-spinner" />
        <strong>Redirecting to login…</strong>
      </main>
    );
  }

  return <>{children}</>;
}
