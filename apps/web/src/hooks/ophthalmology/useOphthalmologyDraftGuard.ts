import { useCallback, useEffect, useRef } from 'react';
import { useUnsavedNavigation } from '../../routing/navigation';
import { clearEncounterDraft, hasEncounterDirtyDrafts } from './encounter-draft-cache';
import { confirmAction } from '../../components/ui/confirm-action';

const confirmDiscard = () => confirmAction('Discard unsaved changes?');

export * from './encounter-draft-cache';
export const INTERNAL_TAB_KEYS = new Set(['care_tab', 'section', 'area']);

// 3. Draft Guard Hook
export function useOphthalmologyDraftGuard(dirty: boolean, identityKeys: string[]) {
  const committed = useRef(false);
  const currentParams = new URLSearchParams(window.location.search);
  const currentVisitId = currentParams.get('visit_id') ?? currentParams.get('id') ?? '';
  const pathname = window.location.pathname;

  const leavesDraft = useCallback((target: URL) => {
    if (committed.current) {
      committed.current = false;
      return false;
    }

    // Leaving route pathname completely (e.g. to /opd/queue, /billing, /patients)
    if (target.pathname !== pathname) return true;

    // Switching patient encounter (different visit_id or id)
    const targetVisitId = target.searchParams.get('visit_id') ?? target.searchParams.get('id') ?? '';
    if (currentVisitId && targetVisitId && currentVisitId !== targetVisitId) return true;

    // Check non-internal identity keys
    const currentSearch = new URLSearchParams(window.location.search);
    for (const key of identityKeys) {
      if (INTERNAL_TAB_KEYS.has(key)) {
        continue;
      }
      if (target.searchParams.get(key) !== currentSearch.get(key)) {
        return true;
      }
    }

    return false;
  }, [identityKeys, pathname, currentVisitId]);

  const effectiveDirty = dirty || (Boolean(currentVisitId) && hasEncounterDirtyDrafts(currentVisitId));

  useUnsavedNavigation(effectiveDirty, leavesDraft, confirmDiscard);

  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (effectiveDirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [effectiveDirty]);

  return () => {
    committed.current = true;
    if (currentVisitId) {
      clearEncounterDraft(currentVisitId);
    }
  };
}
