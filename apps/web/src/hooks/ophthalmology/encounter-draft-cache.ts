// Encounter-scoped draft cache to preserve data across internal tab switches
type DraftEntry = {
  data: unknown;
  isDirty: boolean;
};

const encounterDraftCache = new Map<string, Map<string, DraftEntry>>();

export function getEncounterDraft<T>(visitId: string, sectionKey: string): T | null {
  if (!visitId) return null;
  const visitCache = encounterDraftCache.get(visitId);
  return (visitCache?.get(sectionKey)?.data as T) ?? null;
}

export function setEncounterDraft(visitId: string, sectionKey: string, data: unknown, isDirty: boolean): void {
  if (!visitId) return;
  let visitCache = encounterDraftCache.get(visitId);
  if (!visitCache) {
    visitCache = new Map();
    encounterDraftCache.set(visitId, visitCache);
  }
  visitCache.set(sectionKey, { data, isDirty });
}

export function clearEncounterDraft(visitId: string, sectionKey?: string): void {
  if (!visitId) return;
  if (!sectionKey) {
    encounterDraftCache.delete(visitId);
  } else {
    encounterDraftCache.get(visitId)?.delete(sectionKey);
  }
}

export function hasEncounterDirtyDrafts(visitId: string): boolean {
  if (!visitId) return false;
  const visitCache = encounterDraftCache.get(visitId);
  if (!visitCache) return false;
  for (const entry of visitCache.values()) {
    if (entry.isDirty) return true;
  }
  return false;
}

// Draft Save Handler Registry for the footer Save Draft action
export type DraftSaveHandler = () => Promise<boolean | void>;

const draftSaveHandlers = new Map<string, DraftSaveHandler>();

export function registerDraftSaveHandler(key: string, handler: DraftSaveHandler): () => void {
  draftSaveHandlers.set(key, handler);
  return () => {
    if (draftSaveHandlers.get(key) === handler) {
      draftSaveHandlers.delete(key);
    }
  };
}

export async function executeActiveDraftSave(key = 'current'): Promise<boolean> {
  const handler = draftSaveHandlers.get(key);
  if (!handler) return false;
  await handler();
  return true;
}
