import { useEffect, type PropsWithChildren } from 'react';
import { LoadingState } from '../components/LoadingState';
import { useAuth } from '../auth/useAuth';
import { isPublicRoute, navigate, useAppLocation } from './navigation';

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { status } = useAuth();
  const location = useAppLocation();

  useEffect(() => {
    if (status === 'unauthenticated' || status === 'session-expired') {
      if (isPublicRoute(location.pathname)) {
        return;
      }

      const redirect = `${location.pathname}${location.search}`;
      const params = new URLSearchParams({
        redirect,
        ...(status === 'session-expired' ? { reason: 'session-expired' } : {}),
      });

      navigate(`/login?${params.toString()}`, { replace: true });
    }
  }, [location.pathname, location.search, status]);

  if (status !== 'authenticated') {
    return <LoadingState />;
  }

  return children;
}
