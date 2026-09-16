import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DentalLabSection } from './DentalLabSection';
import { opdApi, type OpdClinicalOrderResponse, type SaveOpdClinicalOrderPayload } from '../../../api/opd';
import { servicesApi, type ServiceResponse } from '../../../api/services';
import { laboratoryApi } from '../../../api/laboratory';

const auth = { allowed: true };
vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({
    user: auth.allowed
      ? { username: 'dentist_user', roles: [{ code: 'DOCTOR' }], permissions: [{ module: 'OPD', screen: 'OPD Clinical Orders', action: 'View' }] }
      : { username: 'reception_user', roles: [{ code: 'RECEPTIONIST' }], permissions: [] },
  }),
}));

const service: ServiceResponse = {
  id: '507f1f77bcf86cd799439011', code: 'DENT-LAB-001', name: 'Complete Blood Count', service_type: 'LAB_TEST',
  category: 'Hematology', description: null, department_id: 'dept-1', standard_price: 30.0, default_duration_minutes: null,
  booking_capacity: null, requires_bed: false, requires_consent: false, requires_advance_deposit: false,
  minimum_advance_deposit_amount: null, status: 'ACTIVE', created_at: '', updated_at: '', created_by: null, updated_by: null,
};
const record: OpdClinicalOrderResponse = {
  id: 'order-1', originating_order_id: 'order-1', visit_id: 'visit-1', consultation_id: 'consult-1', patient_id: 'patient-1', patient_number: 'P-1001',
  patient_name: 'Dental Patient', doctor_id: 'doc-1', doctor_name: 'Dr. Dentist', branch_id: 'branch-1', order_type: 'LABORATORY',
  status: 'DRAFT', priority: 'ROUTINE', destination: null, specimen_type: 'Blood', clinical_notes: null, instructions: null,
  submitted_at: null, items: [], created_by: 'doc-1', updated_by: 'doc-1', created_at: '', updated_at: '2026-09-15T00:00:00Z',
};

describe('Phase 11B Dental Lab Integration Component', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let persisted: OpdClinicalOrderResponse | null;

  const draft: SaveOpdClinicalOrderPayload = { priority: 'ROUTINE', specimen_type: 'Blood', items: [] };

  const render = async (active = true, canEdit = true, consultationCompleted = false) => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalLabSection
            visitId="visit-1"
            active={active}
            canEdit={canEdit}
            consultationCompleted={consultationCompleted}
            draft={draft}
          />
        </QueryClientProvider>,
      );
    });
  };

  const settle = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  };

  const clickTrigger = async (text: string) => {
    const button = Array.from(document.body.querySelectorAll('button')).find((b) => !b.getAttribute('form') && b.textContent?.includes(text));
    if (!button) throw new Error(`Trigger button "${text}" not found`);
    await act(async () => {
      button.click();
    });
  };

  const clickModalSubmit = async () => {
    const button = document.body.querySelector('button[form="dental-lab-form"]') as HTMLButtonElement;
    if (!button) throw new Error('Modal submit button not found');
    await act(async () => {
      button.click();
    });
  };

  beforeEach(() => {
    auth.allowed = true;
    persisted = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

    vi.spyOn(opdApi, 'getClinicalOrder').mockImplementation(async () => persisted);
    vi.spyOn(servicesApi, 'list').mockResolvedValue({ data: [service], meta: { page: 1, limit: 100, total: 1, totalPages: 1 } });
    vi.spyOn(opdApi, 'saveClinicalOrderDraft').mockImplementation(async (_visit, _type, payload) => {
      persisted = { ...record, specimen_type: payload.specimen_type || 'Blood', items: payload.items.map((item) => ({ ...item, id: 'item-1', service_name: item.investigation_name })) };
      return persisted;
    });
    vi.spyOn(opdApi, 'submitClinicalOrder').mockImplementation(async () => {
      if (persisted) persisted = { ...persisted, status: 'SUBMITTED' };
      return persisted!;
    });
    vi.spyOn(laboratoryApi, 'getResult').mockResolvedValue({
      id: 'result-1', order_id: 'order-1', visit_id: 'visit-1', patient_id: 'patient-1', source_type: 'OPD', encounter_id: 'visit-1', admission_id: null, procedure_id: null,
      remarks: 'Normal blood count', entered_by: 'lab-user', entered_at: '', verified_by: 'lab-user', verified_at: '2026-09-15T01:00:00Z', created_at: '', updated_at: '',
      result_items: [{ service_id: '507f1f77bcf86cd799439011', service_name: 'CBC', value: '14.2', unit: 'g/dL', reference_range: '12-16', comments: 'NORMAL' }],
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    queryClient.clear();
    vi.restoreAllMocks();
  });

  it('loads catalogue only on explicit action and creates Lab order without tooth_number', async () => {
    await render();
    await settle();
    expect(servicesApi.list).not.toHaveBeenCalled();

    await clickTrigger('+ Add Lab Investigation');
    await settle();
    expect(servicesApi.list).toHaveBeenCalledWith(expect.objectContaining({ service_type: 'LAB_TEST', status: 'ACTIVE' }));

    const radio = document.body.querySelector(`input[name="serviceId"][value="${service.id}"]`) as HTMLInputElement;
    expect(radio).toBeTruthy();
    await act(async () => {
      radio.click();
    });

    await clickModalSubmit();
    await settle();

    expect(opdApi.saveClinicalOrderDraft).toHaveBeenCalledWith(
      'visit-1',
      'LABORATORY',
      expect.objectContaining({
        items: [
          expect.objectContaining({
            service_id: service.id,
            investigation_name: 'Complete Blood Count',
            tooth_number: null,
          }),
        ],
      }),
    );
  });

  it('formats lab prices using global currency and mounts fixed footer layout without pagination', async () => {
    await render();
    await settle();
    await clickTrigger('+ Add Lab Investigation');
    await settle();

    // Global currency formatting check
    expect(document.body.textContent).toMatch(/KES\s*30\.00|\$30\.00/);

    // Pagination controls removed
    expect(document.body.textContent).not.toContain('Previous');
    expect(document.body.textContent).not.toContain('Next');
    expect(document.body.textContent).not.toContain('Page 1');

    // Search input placeholder
    const searchInput = document.body.querySelector('input[type="search"]') as HTMLInputElement;
    expect(searchInput?.placeholder).toBe('Search dental laboratory services...');

    // Fixed footer check
    const modalFooter = document.body.querySelector('.modal-footer');
    expect(modalFooter).not.toBeNull();
    const submitBtn = modalFooter?.querySelector('button[form="dental-lab-form"]');
    expect(submitBtn?.textContent).toContain('Add Lab Investigation');
  });

  it('submits Lab request to Laboratory and loads Lab results when available', async () => {
    persisted = {
      ...record,
      status: 'DRAFT',
      items: [{ id: 'item-1', service_id: service.id, service_name: 'CBC', investigation_name: 'CBC', category: 'Laboratory', tooth_number: null }],
    };

    await render(true, true, true);
    await settle();

    expect(document.body.textContent).toContain('Submit laboratory request');
    const submitReqBtn = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes('Submit laboratory request'));
    await act(async () => { submitReqBtn?.click(); });
    await settle();
    expect(opdApi.submitClinicalOrder).toHaveBeenCalledWith('visit-1', 'LABORATORY', expect.anything());

    persisted = { ...persisted, status: 'VERIFIED' };
    queryClient.setQueryData(['opd', 'clinicalOrders', 'visit-1', 'LABORATORY'], persisted);
    await render(true, true, true);
    await settle();

    expect(document.body.textContent).toContain('View laboratory results');
    const viewResultsBtn = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes('View laboratory results'));
    await act(async () => { viewResultsBtn?.click(); });
    await settle();

    expect(laboratoryApi.getResult).toHaveBeenCalledWith('order-1');
    expect(document.body.textContent).toContain('Normal blood count');
    expect(document.body.textContent).toContain('14.2');
  });

  it('gates unauthorized view-only users and disables add action when canEdit is false or consultation completed', async () => {
    auth.allowed = false;
    await render();
    await settle();
    expect(document.body.textContent).toContain('You do not have permission to view laboratory requests');

    auth.allowed = true;
    await render(true, false, false);
    await settle();
    expect(document.body.textContent).not.toContain('+ Add Lab Investigation');

    await render(true, true, true);
    await settle();
    expect(document.body.textContent).not.toContain('+ Add Lab Investigation');
  });
});
