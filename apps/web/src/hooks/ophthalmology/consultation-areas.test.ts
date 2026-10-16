import { describe, expect, it } from 'vitest';
import { compatibleSubtypes, consultationAreas } from './consultation-areas';
describe('specialty consultation shell contracts', () => {
  it('keeps all 13 FSD areas in their defined order', () => {
    expect(consultationAreas).toHaveLength(13);
    expect(new Set(consultationAreas.map((area) => area.id)).size).toBe(13);
    expect(consultationAreas[0]?.label).toBe('Patient Summary'); expect(consultationAreas[12]?.label).toBe('Consultation Summary');
  });
  it('maps review subtypes without changing the shared visit enum or selecting a clinical subtype by assumption', () => {
    expect(compatibleSubtypes('REVIEW')).toEqual(['POST_OPERATIVE', 'SCREENING', 'PROCEDURE_REVIEW']);
    expect(compatibleSubtypes('FOLLOW_UP')).toEqual(['FOLLOW_UP']);
    expect(compatibleSubtypes('WALK_IN')).toHaveLength(6);
    expect(compatibleSubtypes('PROCEDURE')).toEqual([]); expect(compatibleSubtypes(undefined)).toEqual([]);
  });
});
