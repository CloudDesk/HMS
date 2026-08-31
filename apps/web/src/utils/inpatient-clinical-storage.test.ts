import { describe, expect, it, vi } from 'vitest';
import { LEGACY_INPATIENT_CLINICAL_STORAGE_KEYS, removeLegacyInpatientClinicalStorage } from './inpatient-clinical-storage';

describe('H-005 browser clinical storage boundary', () => {
  it('removes only the three legacy clinical keys without reading or migrating them', () => {
    const getItem = vi.fn(); const setItem = vi.fn(); const removeItem = vi.fn();
    removeLegacyInpatientClinicalStorage({ getItem, setItem, removeItem } as unknown as Storage);
    expect(removeItem.mock.calls.map(([key]) => key)).toEqual([...LEGACY_INPATIENT_CLINICAL_STORAGE_KEYS]);
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});
