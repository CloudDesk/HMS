import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { opdApi, type OpdClinicalOrderResponse, type SaveOpdClinicalOrderPayload } from '../../../api/opd';
import { servicesApi, type ServiceResponse } from '../../../api/services';
import { imagingApi } from '../../../api/imaging';
import { DentalImagingSection } from './DentalImagingSection';

const auth = vi.hoisted(() => ({ allowed: true }));
vi.mock('../../../auth/useAuth', () => ({ useAuth: () => ({ user: { roles: [], permissions: auth.allowed ? [{ module: 'OPD', screen: 'OPD Clinical Orders', action: 'View' }] : [] } }) }));
vi.mock('../../../routing/navigation', () => ({ useAppLocation: () => ({ pathname: '/opd/consultation', search: '?id=visit-1&tab=Dental+Examination' }), navigate: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const serviceId = '507f1f77bcf86cd799439011';
const service: ServiceResponse = {
  id: serviceId, name: 'IOPA X-Ray', code: 'IOPA', service_type: 'IMAGING_SERVICE', category: 'Dental Imaging',
  description: null, department_id: 'dental', standard_price: 50, default_duration_minutes: null,
  booking_capacity: null, requires_bed: false, requires_consent: false, requires_advance_deposit: false,
  minimum_advance_deposit_amount: null, status: 'ACTIVE', created_at: '', updated_at: '', created_by: null, updated_by: null,
};
const record: OpdClinicalOrderResponse = {
  id: 'order-1', originating_order_id: 'order-1', visit_id: 'visit-1', consultation_id: 'consult-1',
  patient_id: 'patient-1', patient_name: 'Test Patient', patient_number: 'TEST-1', doctor_id: 'doctor-1', doctor_name: 'Test Dentist', branch_id: 'branch-1',
  order_type: 'IMAGING', status: 'DRAFT', priority: 'ROUTINE', destination: null, specimen_type: null,
  items: [], clinical_notes: null, instructions: null, submitted_at: null, created_by: null, updated_by: null,
  created_at: '2026-09-15T01:00:00.000Z', updated_at: '2026-09-15T01:00:00.000Z',
};
let root: Root;
let container: HTMLDivElement;
let persisted: OpdClinicalOrderResponse | null;
let queryClient: QueryClient;
const draft: SaveOpdClinicalOrderPayload = { priority: 'ROUTINE', items: [] };

const clickTrigger = async (text: string) => {
  const found = Array.from(document.querySelectorAll('button')).find((item) => !item.getAttribute('form') && item.textContent?.includes(text));
  if (!found) throw new Error(`Missing trigger button ${text}`);
  await act(async () => found.click());
};

const clickModalSubmit = async () => {
  const found = document.querySelector<HTMLButtonElement>('button[form="dental-imaging-form"]');
  if (!found) throw new Error('Missing modal submit button');
  await act(async () => found.click());
};

const render = async (selectedTooth: number | null = 35, active = true, canEdit = true) => {
  await act(async () => { root.render(<QueryClientProvider client={queryClient}><DentalImagingSection visitId="visit-1" selectedTooth={selectedTooth} active={active} canEdit={canEdit} consultationCompleted={false} draft={draft} /></QueryClientProvider>); });
};
const settle = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); }); };

describe('Phase 11A Dental tooth imaging', () => {
  beforeEach(() => {
    auth.allowed = true;
    persisted = null;
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.spyOn(opdApi, 'getClinicalOrder').mockImplementation(async () => persisted);
    vi.spyOn(servicesApi, 'list').mockResolvedValue({ data: [service], meta: { page: 1, limit: 100, total: 1, totalPages: 1 } });
    vi.spyOn(opdApi, 'saveClinicalOrderDraft').mockImplementation(async (_visit, _type, payload) => {
      persisted = { ...record, items: payload.items.map((item) => ({ ...item, id: 'item-1', service_name: item.investigation_name })) };
      return persisted;
    });
    vi.spyOn(opdApi, 'submitClinicalOrder').mockRejectedValue(new Error('Unexpected automatic submit'));
    vi.spyOn(imagingApi, 'getReport').mockResolvedValue({ id: 'report-1', order_id: 'order-1', visit_id: 'visit-1', patient_id: 'patient-1', source_type: 'OPD', encounter_id: 'visit-1', admission_id: null, procedure_id: null,
      findings: 'Existing radiology findings', impression: 'Existing radiology impression', entered_by: 'imaging-user', entered_at: '', verified_by: 'imaging-user', verified_at: '2026-09-15T01:00:00Z', created_at: '', updated_at: '' });
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); queryClient.clear(); vi.restoreAllMocks(); });

  it('loads catalogue only on explicit action and persists the selected tooth after remount', async () => {
    await render(); await settle();
    expect(servicesApi.list).not.toHaveBeenCalled();
    expect(opdApi.saveClinicalOrderDraft).not.toHaveBeenCalled();
    await render(36); await settle();
    expect(opdApi.saveClinicalOrderDraft).not.toHaveBeenCalled();
    await render(35); await clickTrigger('+ Add X-Ray / Scan'); await settle();
    expect(servicesApi.list).toHaveBeenCalledWith(expect.objectContaining({ service_type: 'IMAGING_SERVICE', status: 'ACTIVE' }));
    const tooth = document.querySelector<HTMLSelectElement>('select[name="tooth"]');
    expect(tooth?.value).toBe('35');
    const radio = document.querySelector<HTMLInputElement>(`input[name="serviceId"][value="${serviceId}"]`);
    if (!radio) throw new Error('Missing service selector');
    await act(async () => { radio.click(); });
    await clickModalSubmit(); await settle();
    expect(opdApi.saveClinicalOrderDraft).toHaveBeenCalledWith('visit-1', 'IMAGING', expect.objectContaining({ items: [expect.objectContaining({ service_id: serviceId, tooth_number: 35 })] }));
    expect(container.textContent).toContain('IOPA X-Ray');
    expect(container.textContent).toContain('DRAFT');
    expect(opdApi.submitClinicalOrder).not.toHaveBeenCalled();
    await act(async () => root.unmount()); queryClient.clear(); root = createRoot(container);
    await render(); await settle();
    expect(container.textContent).toContain('IOPA X-Ray');
    expect(container.textContent).toContain('Tooth #35');
    expect(opdApi.saveClinicalOrderDraft).toHaveBeenCalledTimes(1);
  });

  it('allows full-mouth imaging with no tooth selected', async () => {
    await render(null); await settle(); await clickTrigger('+ Add X-Ray / Scan'); await settle();
    const radio = document.querySelector<HTMLInputElement>(`input[name="serviceId"][value="${serviceId}"]`);
    if (!radio) throw new Error('Missing service selector');
    await act(async () => { radio.click(); });
    await clickModalSubmit(); await settle();
    expect(persisted?.items[0]?.tooth_number).toBeNull();
    expect(container.textContent).toContain('General / Full Mouth');
  });

  it('formats service prices using configured global currency and mounts fixed footer layout without pagination', async () => {
    await render(35); await settle(); await clickTrigger('+ Add X-Ray / Scan'); await settle();
    
    // Global currency formatting check (Intl format for KES/USD default)
    expect(document.body.textContent).toMatch(/KES\s*50\.00|\$50\.00/);
    
    // Pagination controls removed
    expect(document.body.textContent).not.toContain('Previous');
    expect(document.body.textContent).not.toContain('Next');
    expect(document.body.textContent).not.toContain('Page 1');

    // Search input placeholder
    const searchInput = document.querySelector<HTMLInputElement>('input[type="search"]');
    expect(searchInput?.placeholder).toBe('Search dental imaging...');

    // Fixed footer check
    const modalFooter = document.querySelector('.modal-footer');
    expect(modalFooter).not.toBeNull();
    const submitBtn = modalFooter?.querySelector('button[form="dental-imaging-form"]');
    expect(submitBtn?.textContent).toContain('Add X-Ray / Scan');
  });

  it('shows actual status and loads the existing report only when requested', async () => {
    persisted = { ...record, status: 'COMPLETED', items: [{ id: 'item-1', service_id: serviceId, service_name: 'IOPA X-Ray', investigation_name: 'IOPA X-Ray', category: 'Dental Imaging', tooth_number: 35 }] };
    await render(); await settle();
    expect(container.textContent).toContain('COMPLETED');
    expect(container.textContent).not.toContain('+ Add X-Ray / Scan');
    expect(imagingApi.getReport).not.toHaveBeenCalled();
    const viewReportBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('View report'));
    await act(async () => { viewReportBtn?.click(); }); await settle();
    expect(imagingApi.getReport).toHaveBeenCalledWith('order-1');
    expect(container.textContent).toContain('Existing radiology findings');
    expect(container.textContent).toContain('Verified report');
  });

  it('gates unauthorized and inactive views and disables editing for view-only users', async () => {
    auth.allowed = false; await render(); await settle();
    expect(opdApi.getClinicalOrder).not.toHaveBeenCalled();
    expect(container.textContent).toContain('permission');
    auth.allowed = true; await render(35, false); await settle();
    expect(opdApi.getClinicalOrder).not.toHaveBeenCalled();
    await render(35, true, false); await settle();
    expect(container.textContent).not.toContain('+ Add X-Ray / Scan');
    expect(servicesApi.list).not.toHaveBeenCalled();
  });
});
