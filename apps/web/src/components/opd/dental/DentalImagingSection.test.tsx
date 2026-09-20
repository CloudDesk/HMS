import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { opdApi, type OpdClinicalOrderResponse, type SaveOpdClinicalOrderPayload } from '../../../api/opd';
import { servicesApi, type ServiceResponse } from '../../../api/services';
import { imagingApi } from '../../../api/imaging';
import { DentalImagingSection } from './DentalImagingSection';

const auth = vi.hoisted(() => ({ allowed: true }));
vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({
    user: {
      roles: [],
      permissions: auth.allowed
        ? [{ module: 'OPD', screen: 'OPD Clinical Orders', action: 'View' }]
        : [],
    },
  }),
}));
vi.mock('../../../routing/navigation', () => ({
  useAppLocation: () => ({ pathname: '/opd/consultation', search: '?id=visit-1&tab=Dental+Examination' }),
  navigate: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const serviceId = '507f1f77bcf86cd799439011';
const service: ServiceResponse = {
  id: serviceId,
  name: 'IOPA X-Ray',
  code: 'IOPA',
  service_type: 'IMAGING_SERVICE',
  category: 'Dental Imaging',
  description: null,
  department_id: 'dental',
  standard_price: 50,
  default_duration_minutes: null,
  booking_capacity: null,
  requires_bed: false,
  requires_consent: false,
  requires_advance_deposit: false,
  minimum_advance_deposit_amount: null,
  status: 'ACTIVE',
  created_at: '',
  updated_at: '',
  created_by: null,
  updated_by: null,
};

const record: OpdClinicalOrderResponse = {
  id: 'order-1',
  originating_order_id: 'order-1',
  visit_id: 'visit-1',
  consultation_id: 'consult-1',
  patient_id: 'patient-1',
  patient_name: 'Test Patient',
  patient_number: 'TEST-1',
  doctor_id: 'doctor-1',
  doctor_name: 'Test Dentist',
  branch_id: 'branch-1',
  order_type: 'IMAGING',
  status: 'DRAFT',
  priority: 'ROUTINE',
  destination: null,
  specimen_type: null,
  items: [],
  clinical_notes: null,
  instructions: null,
  submitted_at: null,
  created_by: null,
  updated_by: null,
  created_at: '2026-09-15T01:00:00.000Z',
  updated_at: '2026-09-15T01:00:00.000Z',
};

let root: Root;
let container: HTMLDivElement;
let persisted: OpdClinicalOrderResponse | null;
let queryClient: QueryClient;
const draft: SaveOpdClinicalOrderPayload = { priority: 'ROUTINE', items: [] };

const clickTrigger = async (text: string) => {
  const found = Array.from(document.querySelectorAll('button')).find(
    (item) => !item.getAttribute('form') && item.textContent?.includes(text)
  );
  if (!found) throw new Error(`Missing trigger button ${text}`);
  await act(async () => found.click());
};

const clickModalSubmit = async () => {
  const found = document.querySelector<HTMLButtonElement>('button[form="dental-imaging-form"]');
  if (!found) throw new Error('Missing modal submit button');
  await act(async () => found.click());
};

const render = async (
  selectedTooth: number | null = 35,
  active = true,
  canEdit = true,
  episodeId: string | null = 'ep-1',
  consultationCompleted = false
) => {
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <DentalImagingSection
          visitId="visit-1"
          episodeId={episodeId}
          selectedTooth={selectedTooth}
          active={active}
          canEdit={canEdit}
          consultationCompleted={consultationCompleted}
          draft={draft}
        />
      </QueryClientProvider>
    );
  });
};

const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
};

describe('Phase 4C Chairside Dental Imaging Workflow', () => {
  beforeEach(() => {
    auth.allowed = true;
    persisted = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.spyOn(opdApi, 'getClinicalOrder').mockImplementation(async () => persisted);
    vi.spyOn(opdApi, 'getEpisodeImagingOrders').mockResolvedValue([]);
    vi.spyOn(opdApi, 'listDentalChairsideImages').mockResolvedValue([]);
    vi.spyOn(opdApi, 'listEpisodeChairsideImages').mockResolvedValue([]);
    vi.spyOn(servicesApi, 'list').mockResolvedValue({
      data: [service],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    vi.spyOn(opdApi, 'saveClinicalOrderDraft').mockImplementation(async (_visit, _type, payload) => {
      persisted = {
        ...record,
        clinical_notes: payload.clinical_notes ?? null,
        dental_context: payload.dental_context ?? null,
        items: payload.items.map((item) => ({
          ...item,
          id: 'item-1',
          service_name: item.investigation_name,
        })),
      };
      return persisted;
    });
    vi.spyOn(opdApi, 'submitClinicalOrder').mockImplementation(async (_visit, _type, payload) => {
      persisted = {
        ...record,
        status: 'SUBMITTED',
        clinical_notes: payload.clinical_notes ?? null,
        dental_context: payload.dental_context ?? null,
        items: payload.items.map((item) => ({
          ...item,
          id: 'item-1',
          service_name: item.investigation_name,
        })),
      };
      return persisted;
    });
    vi.spyOn(imagingApi, 'getReport').mockResolvedValue({
      id: 'report-1',
      order_id: 'order-1',
      visit_id: 'visit-1',
      patient_id: 'patient-1',
      source_type: 'OPD',
      encounter_id: 'visit-1',
      admission_id: null,
      procedure_id: null,
      findings: 'Periapical bone resorption at tooth 35 apex',
      impression: 'Apical periodontitis tooth 35',
      recommendations: 'Endodontic treatment indicated',
      entered_by: 'imaging-user',
      entered_at: '2026-09-18T10:00:00Z',
      verified_by: 'imaging-user',
      verified_at: '2026-09-18T10:15:00Z',
      created_at: '',
      updated_at: '',
      attachments: [
        {
          id: 'att-1',
          file_name: 'iopa_35_preop.jpg',
          file_size_bytes: 409600,
          mime_type: 'image/jpeg',
          storage_key: 'patients/p1/iopa_35_preop.jpg',
          file_url: null,
          uploaded_at: '2026-09-18T10:05:00Z',
          uploaded_by: 'imaging-user',
        },
      ],
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    queryClient.clear();
    vi.restoreAllMocks();
  });

  it('1. Dentist orders tooth imaging with clinical indication and dental episode context', async () => {
    await render(35, true, true, 'ep-99');
    await settle();
    await clickTrigger('+ Add X-Ray / Scan');
    await settle();

    const tooth = document.querySelector<HTMLSelectElement>('select[name="tooth"]');
    expect(tooth?.value).toBe('35');

    const radio = document.querySelector<HTMLInputElement>(
      `input[name="serviceId"][value="${serviceId}"]`
    );
    if (!radio) throw new Error('Missing service selector');
    await act(async () => {
      radio.click();
    });

    const notesInput = document.querySelector<HTMLInputElement>('input[name="clinicalNotes"]');
    expect(notesInput).not.toBeNull();
    if (notesInput) {
      await act(async () => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeInputValueSetter?.call(notesInput, 'Suspected deep pulp involvement');
        notesInput.dispatchEvent(new Event('input', { bubbles: true }));
        notesInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    await clickModalSubmit();
    await settle();

    expect(opdApi.saveClinicalOrderDraft).toHaveBeenCalledWith(
      'visit-1',
      'IMAGING',
      expect.objectContaining({
        clinical_notes: 'Suspected deep pulp involvement',
        dental_context: expect.objectContaining({
          treatment_episode_id: 'ep-99',
          tooth_number: 35,
        }),
        items: [expect.objectContaining({ service_id: serviceId, tooth_number: 35 })],
      })
    );

    expect(container.textContent).toContain('IOPA X-Ray');
    expect(container.textContent).toContain('Tooth #35');
    expect(container.textContent).toContain('Indication: Suspected deep pulp involvement');
    expect(container.textContent).toContain('DRAFT');
  });

  it('2. Allows full-mouth imaging without a tooth selected', async () => {
    await render(null);
    await settle();
    await clickTrigger('+ Add X-Ray / Scan');
    await settle();

    const radio = document.querySelector<HTMLInputElement>(
      `input[name="serviceId"][value="${serviceId}"]`
    );
    if (!radio) throw new Error('Missing service selector');
    await act(async () => {
      radio.click();
    });
    await clickModalSubmit();
    await settle();

    expect(persisted?.items[0]?.tooth_number).toBeNull();
    expect(container.textContent).toContain('General / Full Mouth');
  });

  it('3. Displays actual order status (SUBMITTED / IN_PROGRESS / REPORT_ENTERED)', async () => {
    persisted = {
      ...record,
      status: 'IN_PROGRESS',
      items: [
        {
          id: 'item-1',
          service_id: serviceId,
          service_name: 'IOPA X-Ray',
          investigation_name: 'IOPA X-Ray',
          category: 'Dental Imaging',
          tooth_number: 35,
        },
      ],
    };
    await render();
    await settle();

    expect(container.textContent).toContain('IN PROGRESS');
    expect(container.textContent).toContain('In Progress');
  });

  it('4. Loads and displays available report and attachments', async () => {
    persisted = {
      ...record,
      status: 'COMPLETED',
      items: [
        {
          id: 'item-1',
          service_id: serviceId,
          service_name: 'IOPA X-Ray',
          investigation_name: 'IOPA X-Ray',
          category: 'Dental Imaging',
          tooth_number: 35,
        },
      ],
    };
    await render();
    await settle();

    expect(container.textContent).toContain('Report Available');
    const viewReportBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('View report')
    );
    await act(async () => {
      viewReportBtn?.click();
    });
    await settle();

    expect(imagingApi.getReport).toHaveBeenCalledWith('order-1');
    expect(container.textContent).toContain('Periapical bone resorption at tooth 35 apex');
    expect(container.textContent).toContain('iopa_35_preop.jpg');
    expect(container.textContent).toContain('400.0 KB');
  });

  it('5. View Image button on attachment opens DentalImageViewerModal', async () => {
    persisted = {
      ...record,
      status: 'COMPLETED',
      items: [
        {
          id: 'item-1',
          service_id: serviceId,
          service_name: 'IOPA X-Ray',
          investigation_name: 'IOPA X-Ray',
          category: 'Dental Imaging',
          tooth_number: 35,
        },
      ],
    };
    await render();
    await settle();

    const viewReportBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('View report')
    );
    await act(async () => {
      viewReportBtn?.click();
    });
    await settle();

    const viewImageBtn = document.querySelector<HTMLButtonElement>(
      'button[aria-label="View image iopa_35_preop.jpg"]'
    );
    expect(viewImageBtn).not.toBeNull();

    await act(async () => {
      viewImageBtn?.click();
    });
    await settle();

    const modalTitle = document.getElementById('dental-image-viewer-title');
    expect(modalTitle?.textContent).toBe('iopa_35_preop.jpg');

    const viewerImg = document.querySelector<HTMLImageElement>(
      'img[data-testid="dental-viewer-image"]'
    );
    expect(viewerImg?.src).toContain('/api/imaging/orders/order-1/attachments/att-1/download');
  });

  it('6. Displays other episode imaging orders and allows viewing their results', async () => {
    vi.spyOn(opdApi, 'getEpisodeImagingOrders').mockResolvedValue([
      {
        id: 'order-prior',
        originating_order_id: 'order-prior',
        visit_id: 'visit-prior',
        consultation_id: 'consult-prior',
        patient_id: 'patient-1',
        patient_name: 'Test Patient',
        patient_number: 'TEST-1',
        doctor_id: 'doctor-1',
        doctor_name: 'Test Dentist',
        branch_id: 'branch-1',
        order_type: 'IMAGING',
        status: 'COMPLETED',
        priority: 'ROUTINE',
        destination: null,
        specimen_type: null,
        clinical_notes: 'Prior visit CBCT scan',
        instructions: null,
        items: [
          {
            id: 'item-cbct',
            service_id: 'srv-cbct',
            service_name: 'CBCT 3D',
            investigation_name: 'CBCT 3D Scan',
            category: 'Dental Imaging',
            tooth_number: 35,
          },
        ],
        submitted_at: null,
        created_by: null,
        updated_by: null,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
    ]);

    await render(35, true, true, 'ep-99');
    await settle();

    expect(container.textContent).toContain('Other Episode Imaging Orders');
    expect(container.textContent).toContain('CBCT 3D Scan');
    expect(container.textContent).toContain('Prior visit CBCT scan');
  });

  it('7. Enforces permissions and gates editing for unauthorized users', async () => {
    auth.allowed = false;
    await render();
    await settle();
    expect(opdApi.getClinicalOrder).not.toHaveBeenCalled();
    expect(container.textContent).toContain('permission');

    auth.allowed = true;
    await render(35, true, false);
    await settle();
    expect(container.textContent).not.toContain('+ Add X-Ray / Scan');
  });

  it('8. Renders Immediate Chairside Imaging section with Capture & Upload actions', async () => {
    await render(35, true, true, 'ep-1');
    await settle();

    expect(container.textContent).toContain('Immediate Chairside Imaging');
    expect(container.textContent).toContain('Upload Chairside Image');
    expect(container.textContent).toContain('Capture Image');
    expect(container.textContent).toContain('Tooth #35');
    // Radiology orders section remains intact below
    expect(container.textContent).toContain('Formal Radiology Department investigations');
  });

  it('9. Displays uploaded chairside image and allows opening DentalImageViewerModal', async () => {
    vi.spyOn(opdApi, 'listDentalChairsideImages').mockResolvedValue([
      {
        id: 'chairside-img-1',
        visit_id: 'visit-1',
        visit_number: 'VIS-001',
        patient_id: 'patient-1',
        patient_number: 'P-001',
        patient_name: 'Test Patient',
        episode_id: 'ep-1',
        episode_number: 'EP-001',
        examination_id: 'exam-1',
        tooth_number: 35,
        file_name: 'tooth_35_intraoral.jpg',
        file_size_bytes: 204800,
        mime_type: 'image/jpeg',
        storage_key: 'dental-chairside/visit-1/test.jpg',
        file_url: 'http://localhost:3000/api/v1/opd/dental-chairside-images/chairside-img-1/file',
        imaging_source: 'CHAIRSIDE',
        notes: 'Pre-op view tooth 35',
        doctor_id: 'dentist-1',
        doctor_name: 'Dr. Test Dentist',
        branch_id: 'branch-1',
        department_id: 'dept-1',
        created_by: 'dentist-1',
        created_at: '2026-09-20T10:00:00Z',
        updated_at: '2026-09-20T10:00:00Z',
      },
    ]);

    await render(35, true, true, 'ep-1');
    await settle();

    expect(container.textContent).toContain('tooth_35_intraoral.jpg');
    expect(container.textContent).toContain('Tooth #35');
    expect(container.textContent).toContain('Pre-op view tooth 35');

    // Click on image card / view button
    const viewBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('View')
    );
    expect(viewBtn).toBeDefined();

    await act(async () => {
      viewBtn?.click();
    });
    await settle();

    const modalTitle = document.getElementById('dental-image-viewer-title');
    expect(modalTitle?.textContent).toBe('tooth_35_intraoral.jpg');
    const viewerImg = document.querySelector<HTMLImageElement>(
      'img[data-testid="dental-viewer-image"]'
    );
    expect(viewerImg?.src).toContain('chairside-img-1');
  });
});
