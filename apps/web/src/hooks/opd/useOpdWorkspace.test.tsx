import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthPermission } from '../../auth/auth-types';

const state = vi.hoisted(() => ({
  permissions: [] as AuthPermission[],
  queries: new Map<string, unknown[]>(),
  visitId: 'visit-1' as string | null,
  tab: 'Consultation',
  errorQuery: '',
  recordPatientId: 'patient-1',
  query: (name: string, args: unknown[]) => {
    state.queries.set(name, args);
    const record = name === 'visit' ? { id: 'visit-1', patient_id: 'patient-1', branch_id: 'branch-1' }
      : name === 'consultation' ? { visit_id: 'visit-1', patient_id: state.recordPatientId, assessment: 'Confidential cached text' }
      : name === 'inventory' ? { data: [{ medicine_id: 'cached-medicine', available_quantity: 99 }] }
      : { data: [] };
    return { data: record, isLoading: false, error: state.errorQuery === name ? new Error('Record load failed') : null, refetch: vi.fn() };
  },
}));
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { permissions: state.permissions, roles: [] } }) }));
vi.mock('./useOpd', () => ({
  ...Object.fromEntries(([
    ['useOpdVisit', 'visit'], ['useOpdLatestVitals', 'vitals'], ['useOpdConsultation', 'consultation'],
    ['useOpdPrescription', 'prescription'], ['useOpdFollowUp', 'followUp'], ['useOpdReferral', 'referral'], ['useOpdClinicalOrder', 'order'],
  ] as const).map(([hook, name]) => [hook, (...args: unknown[]) => state.query(name, args)])),
  ...Object.fromEntries([
    'useCompleteOpdConsultation', 'useCreateOpdVitals', 'useSaveOpdConsultationDraft', 'useSaveOpdClinicalOrderDraft',
    'useSaveOpdPrescriptionDraft', 'useSaveOpdFollowUpDraft', 'useSaveOpdReferralDraft', 'useScheduleOpdFollowUp',
    'useSubmitOpdClinicalOrder', 'useSubmitOpdPrescription', 'useSubmitOpdReferral', 'useUpdateOpdVisitStatus',
  ].map((hook) => [hook, () => ({ mutateAsync: vi.fn(), isPending: false })])),
}));
vi.mock('../doctors/useDoctors', () => ({ useDoctorsList: (...args: unknown[]) => state.query('doctors', args) }));
vi.mock('../medicines/useMedicines', () => ({ useMedicinesList: (...args: unknown[]) => state.query('medicines', args) }));
vi.mock('../pharmacy/usePharmacy', () => ({ usePharmacyInventoryList: (...args: unknown[]) => state.query('inventory', args) }));
vi.mock('../services/useServices', () => ({ useServicesList: (...args: unknown[]) => state.query('services', args) }));
vi.mock('../patients/usePatients', () => ({
  usePatientDocuments: (...args: unknown[]) => state.query('documents', args),
  useDeletePatientDocument: () => ({ mutateAsync: vi.fn() }),
  useDownloadPatientDocument: () => ({ mutateAsync: vi.fn() }),
  useUploadPatientDocument: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('../appointments/useAppointments', () => ({ useCreateAppointment: () => ({ mutateAsync: vi.fn() }) }));
vi.mock('../billing/useBilling', () => ({ useCreateBillingInvoice: () => ({ mutateAsync: vi.fn() }) }));

import { useOpdWorkspace } from './useOpdWorkspace';

describe('OPD workspace request scope', () => {
  let root: Root;
  let container: HTMLDivElement;
  let workspace: ReturnType<typeof useOpdWorkspace> | undefined;
  function Harness() { workspace = useOpdWorkspace(state.visitId, state.tab); return null; }
  const grant = (module: string, screen: string, action = 'View') => state.permissions.push({ code: `${module}.${screen}.${action}`, module, screen, action });
  beforeEach(() => {
    state.permissions = [];
    state.visitId = 'visit-1'; state.tab = 'Consultation'; state.errorQuery = ''; state.recordPatientId = 'patient-1'; state.queries.clear();
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

  it('disables unauthorized requests and hides their cached clinical and stock data', async () => {
    await act(async () => root.render(<Harness />));
    expect(state.queries.get('visit')).toEqual(['visit-1', false]);
    expect(state.queries.get('consultation')).toEqual(['visit-1', false]);
    expect(state.queries.get('inventory')?.[1]).toBe(false);
    expect(workspace?.visit).toBeNull(); expect(workspace?.consultation).toBeNull(); expect(workspace?.inventory).toEqual([]);
  });

  it('requires endpoint permissions rather than assuming prescribing allows inventory access', async () => {
    grant('OPD', 'OPD Visits'); grant('OPD', 'OPD Prescription');
    state.tab = 'Prescription';
    await act(async () => root.render(<Harness />));
    expect(state.queries.get('prescription')).toEqual(['visit-1', true]);
    expect(state.queries.get('inventory')?.[1]).toBe(false);
    expect(state.queries.get('medicines')?.[1]).toBe(false);
    expect(state.queries.get('services')?.[1]).toBe(false);
  });

  it('loads medication lookups only in the active prescription workflow', async () => {
    grant('OPD', 'OPD Visits'); grant('Administration', 'Medicines'); grant('Pharmacy', 'Medicine Inventory');
    await act(async () => root.render(<Harness />));
    expect(state.queries.get('medicines')?.[1]).toBe(false);
    expect(state.queries.get('inventory')?.[1]).toBe(false);
    state.tab = 'Prescription';
    await act(async () => root.render(<Harness />));
    expect(state.queries.get('medicines')?.[1]).toBe(true);
    expect(state.queries.get('inventory')?.[1]).toBe(true);
    state.visitId = null;
    await act(async () => root.render(<Harness />));
    expect(state.queries.get('medicines')?.[1]).toBe(false);
    expect(state.queries.get('inventory')?.[1]).toBe(false);
  });

  it('does not expose an old encounter record after the selected ID changes', async () => {
    grant('OPD', 'OPD Visits'); grant('OPD', 'OPD Consultation');
    await act(async () => root.render(<Harness />));
    expect(workspace?.consultation?.assessment).toBe('Confidential cached text');
    state.visitId = 'visit-2';
    await act(async () => root.render(<Harness />));
    expect(workspace?.visit).toBeNull(); expect(workspace?.consultation).toBeNull();
  });

  it('surfaces a permitted clinical record load failure instead of treating it as an empty draft', async () => {
    grant('OPD', 'OPD Visits'); grant('OPD', 'OPD Consultation'); state.errorQuery = 'consultation';
    await act(async () => root.render(<Harness />));
    expect(workspace?.visitError?.message).toBe('Record load failed');
    state.permissions = [];
    await act(async () => root.render(<Harness />));
    expect(workspace?.visitError).toBeNull();
  });

  it('rejects a record for another patient even when its visit ID matches', async () => {
    grant('OPD', 'OPD Visits'); grant('OPD', 'OPD Consultation'); state.recordPatientId = 'patient-2';
    await act(async () => root.render(<Harness />));
    expect(workspace?.consultation).toBeNull();
    expect(workspace?.visitError?.message).toContain('do not match the selected patient');
  });
});
