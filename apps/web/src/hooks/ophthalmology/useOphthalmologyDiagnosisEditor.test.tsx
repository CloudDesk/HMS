import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('../opd/useOpd', () => ({ useSaveOpdConsultationDraft: () => ({ mutateAsync: state.save, isPending: false }) }));
import { diagnosisEditSchema, useOphthalmologyDiagnosisEditor } from './useOphthalmologyDiagnosisEditor';
const record = { visit_id: '111111111111111111111111', patient_id: '222222222222222222222222', version: 3, status: 'DRAFT' as const };
const form = { assessment: 'QA assessment', diagnoses: [{ code: 'QA', display: 'QA', codingSystem: 'QA', type: 'PRIMARY' as const, laterality: 'OS' as const, status: 'CONFIRMED' as const, differential: false }] };
describe('versioned specialty structured diagnosis writes', () => {
  let root: Root; let element: HTMLDivElement; let allowed: boolean; let feature: ReturnType<typeof useOphthalmologyDiagnosisEditor>;
  function Harness() { feature = useOphthalmologyDiagnosisEditor(record, allowed); return null; }
  beforeEach(() => { allowed = true; state.save.mockReset(); element = document.createElement('div'); document.body.append(element); root = createRoot(element); });
  afterEach(async () => { await act(async () => root.unmount()); element.remove(); });
  it('requires explicit classification/eye/status and keeps malformed selections out of the wire body', () => { expect(diagnosisEditSchema.safeParse({ assessment: null, diagnoses: [{ ...form.diagnoses[0], type: '', laterality: '', status: '' }] }).success).toBe(false); });
  it('sends original expected version with structured fields while preserving unrelated consultation data', async () => { state.save.mockResolvedValue({ ...record, version: 4 }); await act(async () => root.render(<Harness />)); await act(async () => feature.save(3, form)); expect(state.save).toHaveBeenCalledWith({ visitId: record.visit_id, payload: { ...form, expected_version: 3, expected_status: 'DRAFT' } }); });
  it('blocks denied and stale writes before API calls', async () => { allowed = false; await act(async () => root.render(<Harness />)); await feature.save(3, form); allowed = true; await act(async () => root.render(<Harness />)); await feature.save(2, form); expect(state.save).not.toHaveBeenCalled(); });
  it('locks duplicate writes and suppresses late success after permission loss', async () => { let resolve: ((v: unknown) => void) | undefined; state.save.mockImplementation(() => new Promise((done) => { resolve = done; })); await act(async () => root.render(<Harness />)); const first = feature.save(3, form); await feature.save(3, form); expect(state.save).toHaveBeenCalledOnce(); allowed = false; await act(async () => root.render(<Harness />)); let saved: unknown; await act(async () => { resolve?.({ ...record, version: 4 }); saved = await first; }); expect(saved).toBeUndefined(); });
  it('retains errors after failed saves and rejects wrong-patient responses', async () => { state.save.mockResolvedValue({ ...record, patient_id: 'wrong', version: 4 }); await act(async () => root.render(<Harness />)); await act(async () => feature.save(3, form)); expect(feature.error).toContain('scope'); });
});
