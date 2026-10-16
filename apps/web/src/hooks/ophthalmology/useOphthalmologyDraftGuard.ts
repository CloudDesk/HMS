import { useCallback, useEffect, useRef } from 'react';
import { useUnsavedNavigation } from '../../routing/navigation';

export function useOphthalmologyDraftGuard(dirty: boolean, identityKeys: string[]) {
  const committed = useRef(false);
  const identity = JSON.stringify(identityKeys.map((key) => [key, new URLSearchParams(window.location.search).get(key)]));
  const pathname = window.location.pathname;
  const leavesDraft = useCallback((target: URL) => { if (committed.current) { committed.current = false; return false; } return target.pathname !== pathname || JSON.stringify(identityKeys.map((key) => [key, target.searchParams.get(key)])) !== identity; }, [identity, identityKeys, pathname]);
  useUnsavedNavigation(dirty, leavesDraft);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', unload); return () => window.removeEventListener('beforeunload', unload);
  }, [dirty]);
  return () => { committed.current = true; };
}
