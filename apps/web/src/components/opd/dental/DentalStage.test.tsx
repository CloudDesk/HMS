// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DentalTreatmentPlanSection } from './DentalTreatmentPlanSection';
import type { DentalTreatmentPlanItem, DentalTreatmentStageResponse, DentalTreatmentEpisodeResponse } from '../../../api/opd';
import type { DoctorListResponse } from '../../../api/doctors';

const mockApi = vi.hoisted(() => ({
  listDentalStages: vi.fn(),
  createDentalStage: vi.fn(),
  assignDoctorToDentalStage: vi.fn(),
  updateDentalStageStatus: vi.fn(),
  deleteDentalStage: vi.fn(),
  getEpisodeDentalQuotations: vi.fn(),
  createDentalQuotation: vi.fn(),
  getDentalQuotation: vi.fn(),
  sendDentalQuotation: vi.fn(),
  acceptDentalQuotation: vi.fn(),
  rejectDentalQuotation: vi.fn(),
  postponeDentalQuotation: vi.fn(),
  listPatientDentalEpisodes: vi.fn(),
}));

const mockDoctorsApi = vi.hoisted(() => ({
  list: vi.fn(),
}));

vi.mock('../../../api/opd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/opd')>();
  return {
    ...actual,
    opdApi: {
      ...actual.opdApi,
      ...mockApi,
    },
  };
});

vi.mock('../../../api/doctors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/doctors')>();
  return {
    ...actual,
    doctorsApi: {
      ...actual.doctorsApi,
      ...mockDoctorsApi,
    },
  };
});

vi.mock('../../../api/useSettings', () => ({
  useCurrencyFormatter: () => (val: number) => `$${val.toFixed(2)}`,
}));

const mockDoctors: DoctorListResponse = {
  data: [
    {
      id: 'doc-1',
      doctor_number: 'DOC-01',
      user_id: 'user-1',
      first_name: 'Alice',
      last_name: 'Endo',
      display_name: 'Dr. Alice Endo',
      specialization: 'Endodontics',
      qualification: 'BDS, MDS',
      registration_number: 'DEN123',
      experience_years: 8,
      branch_id: 'branch-1',
      department_id: 'dept-1',
      consultation_room: '101',
      phone: '1234567890',
      email: 'alice@dental.com',
      status: 'ACTIVE',
      notes: null,
      availability: [],
      created_by: null,
      updated_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'doc-2',
      doctor_number: 'DOC-02',
      user_id: 'user-2',
      first_name: 'Bob',
      last_name: 'Prostho',
      display_name: 'Dr. Bob Prostho',
      specialization: 'Prosthodontics',
      qualification: 'BDS, MDS',
      registration_number: 'DEN456',
      experience_years: 12,
      branch_id: 'branch-1',
      department_id: 'dept-1',
      consultation_room: '102',
      phone: '1234567891',
      email: 'bob@dental.com',
      status: 'ACTIVE',
      notes: null,
      availability: [],
      created_by: null,
      updated_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
};

const planItemId = '507f1f77bcf86cd799439011';

const mockStages: DentalTreatmentStageResponse[] = [
  {
    id: 'stage-1',
    episode_id: 'episode-1',
    plan_item_id: planItemId,
    stage_name: 'Root Canal Treatment',
    sequence: 1,
    assigned_doctor_id: 'doc-1',
    assigned_doctor_name: 'Dr. Alice Endo',
    status: 'PLANNED',
    branch_id: 'branch-1',
    department_id: 'dept-1',
    patient_id: 'patient-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'stage-2',
    episode_id: 'episode-1',
    plan_item_id: planItemId,
    stage_name: 'Crown Measurement & Impression',
    sequence: 2,
    assigned_doctor_id: 'doc-2',
    assigned_doctor_name: 'Dr. Bob Prostho',
    status: 'PLANNED',
    branch_id: 'branch-1',
    department_id: 'dept-1',
    patient_id: 'patient-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const mockItems: DentalTreatmentPlanItem[] = [
  {
    id: planItemId,
    tooth_number: 16,
    procedure_name: 'RCT and Ceramic Crown',
    priority: 'HIGH',
    status: 'ACCEPTED',
    estimated_cost: 850,
  },
];

describe('Dental Treatment Stages & Multi-Doctor Workflow Component', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    // @ts-expect-error test env flag
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mockDoctorsApi.list.mockResolvedValue(mockDoctors);
    mockApi.listDentalStages.mockResolvedValue(mockStages);
    mockApi.getEpisodeDentalQuotations.mockResolvedValue([]);

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    queryClient.clear();
  });

  const renderSection = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalTreatmentPlanSection
            items={mockItems}
            teeth={[]}
            onChange={vi.fn()}
            episodeId="episode-1"
            departmentId="dept-1"
          />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  };

  it('renders procedure item and stage toggle button', async () => {
    await renderSection();

    expect(container.textContent).toContain('RCT and Ceramic Crown');
    expect(container.textContent).toContain('Stages (2)');
  });

  it('expands stages drawer and displays multi-doctor stages', async () => {
    await renderSection();

    // Find and click the Stages (2) toggle button
    const stageButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Stages (2)'),
    );
    expect(stageButton).toBeDefined();

    await act(async () => {
      stageButton?.click();
    });

    // Check header and stage details
    expect(container.textContent).toContain('Treatment Stages & Multi-Doctor Care');
    expect(container.textContent).toContain('Root Canal Treatment');
    expect(container.textContent).toContain('Dr. Alice Endo');
    expect(container.textContent).toContain('Crown Measurement & Impression');
    expect(container.textContent).toContain('Dr. Bob Prostho');
  });

  it('displays prerequisite notice and disables starting Stage 2 before Stage 1 completes', async () => {
    await renderSection();

    const stageButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Stages (2)'),
    );
    await act(async () => {
      stageButton?.click();
    });

    // Stage 1 (sequence 1) should have an enabled Schedule button, and no Start button
    const buttons = Array.from(container.querySelectorAll('button'));
    const startButtons = buttons.filter((b) => b.textContent?.trim() === 'Start');
    expect(startButtons.length).toBe(0);

    const scheduleButtons = buttons.filter((b) => b.textContent?.trim() === 'Schedule');
    expect(scheduleButtons.length).toBe(1);
    expect(scheduleButtons[0]!.hasAttribute('disabled')).toBe(false);

    // Stage 2 schedule button is replaced by Prior stage pending lock indicator
    expect(container.textContent).toContain('Prior stage pending');
  });

  it('Phase 7D-1: SCHEDULED fitting stage shows Start button and updates status to IN_PROGRESS on click', async () => {
    mockApi.listDentalStages.mockResolvedValueOnce([
      {
        ...mockStages[0],
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
      },
      {
        ...mockStages[1],
        status: 'SCHEDULED',
        appointment_id: 'appt-1',
        prosthetic_lab_order_id: 'lab-1',
      },
    ]);
    mockApi.updateDentalStageStatus.mockResolvedValueOnce({
      ...mockStages[1],
      status: 'IN_PROGRESS',
    });

    await renderSection();

    const stageButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Stages (2)'),
    );
    await act(async () => {
      stageButton?.click();
    });

    const startBtn = container.querySelector('[data-testid="stage-2-start-btn"]') as HTMLButtonElement;
    expect(startBtn).toBeTruthy();
    expect(startBtn.hasAttribute('disabled')).toBe(false);

    await act(async () => {
      startBtn.click();
    });

    expect(mockApi.updateDentalStageStatus).toHaveBeenCalledWith('stage-2', {
      status: 'IN_PROGRESS',
    });
  });

  it('Phase 7D-1: IN_PROGRESS fitting stage shows Complete button and updates status to COMPLETED on click', async () => {
    mockApi.listDentalStages.mockResolvedValueOnce([
      {
        ...mockStages[0],
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
      },
      {
        ...mockStages[1],
        status: 'IN_PROGRESS',
        appointment_id: 'appt-1',
        prosthetic_lab_order_id: 'lab-1',
      },
    ]);
    mockApi.updateDentalStageStatus.mockResolvedValueOnce({
      ...mockStages[1],
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
    });

    await renderSection();

    const stageButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Stages (2)'),
    );
    await act(async () => {
      stageButton?.click();
    });

    const completeBtn = container.querySelector('[data-testid="stage-2-complete-btn"]') as HTMLButtonElement;
    expect(completeBtn).toBeTruthy();
    expect(completeBtn.hasAttribute('disabled')).toBe(false);

    await act(async () => {
      completeBtn.click();
    });

    expect(mockApi.updateDentalStageStatus).toHaveBeenCalledWith('stage-2', {
      status: 'COMPLETED',
    });
  });

  it('Phase 8A: renders Treatment Quotations section and creates a draft quotation', async () => {
    mockApi.createDentalQuotation.mockResolvedValueOnce({
      id: 'quote-1',
      quotation_number: 'DTQ-2026-00001',
      patient_id: 'patient-1',
      patient_number: 'PAT-001',
      patient_name: 'John Doe',
      treatment_episode_id: 'episode-1',
      doctor_id: 'doc-1',
      doctor_name: 'Dr. Alice Endo',
      branch_id: 'branch-1',
      department_id: 'dept-1',
      status: 'DRAFT',
      currency: 'KES',
      subtotal: 850,
      discount_amount: 50,
      tax_amount: 0,
      total: 800,
      items: [
        {
          id: 'item-1',
          treatment_plan_item_id: planItemId,
          procedure_name: 'RCT and Ceramic Crown',
          tooth_number: 16,
          quantity: 1,
          unit_price: 850,
          discount_amount: 50,
          tax_amount: 0,
          line_total: 800,
        },
      ],
      notes: 'Initial quotation',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await renderSection();

    expect(container.textContent).toContain('Treatment Quotations (Pricing)');
    expect(container.textContent).toContain('No treatment quotations generated for this episode yet');

    const generateBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Generate Quotation') || btn.textContent?.includes('Generate First Quotation'),
    );
    expect(generateBtn).toBeTruthy();

    await act(async () => {
      generateBtn?.click();
    });

    expect(container.textContent).toContain('Generate Treatment Quotation');
    expect(container.textContent).toContain('Treatment Options');

    const createBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Create Draft Quotation'),
    );
    expect(createBtn).toBeTruthy();

    await act(async () => {
      createBtn?.click();
    });

    expect(mockApi.createDentalQuotation).toHaveBeenCalledWith(
      'episode-1',
      expect.objectContaining({
        options: expect.arrayContaining([
          expect.objectContaining({
            name: expect.stringContaining('Option A'),
            items: expect.arrayContaining([
              expect.objectContaining({
                procedure_name: 'RCT and Ceramic Crown',
                tooth_number: 16,
              }),
            ]),
          }),
        ]),
      }),
    );
  });

  it('Phase 8B: allows adding and removing multiple treatment options in quotation generator', async () => {
    await renderSection();

    const generateBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Generate Quotation') || btn.textContent?.includes('Generate First Quotation'),
    );
    expect(generateBtn).toBeTruthy();

    await act(async () => {
      generateBtn?.click();
    });

    // Check initial state has 1 option
    expect(container.textContent).toContain('Treatment Options (1)');

    // Click "Add Option"
    const addOptBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Add Option'),
    );
    expect(addOptBtn).toBeTruthy();

    await act(async () => {
      addOptBtn?.click();
    });

    expect(container.textContent).toContain('Treatment Options (2)');
    expect(container.textContent).toContain('Option B – Alternative');

    // Click remove on the second option
    const removeBtns = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.textContent?.includes('Remove'),
    );
    expect(removeBtns.length).toBeGreaterThan(0);

    await act(async () => {
      removeBtns[0]?.click();
    });

    expect(container.textContent).toContain('Treatment Options (1)');
  });

  it('Phase 8B: displays multi-option quotation details modal with comparison cards', async () => {
    mockApi.getEpisodeDentalQuotations.mockResolvedValueOnce([
      {
        id: 'quote-multi-1',
        quotation_number: 'DTQ-2026-00002',
        patient_id: 'patient-1',
        patient_number: 'PAT-001',
        patient_name: 'John Doe',
        treatment_episode_id: 'episode-1',
        doctor_id: 'doc-1',
        doctor_name: 'Dr. Alice Endo',
        branch_id: 'branch-1',
        department_id: 'dept-1',
        status: 'DRAFT',
        currency: 'USD',
        subtotal: 1200,
        discount_amount: 0,
        tax_amount: 0,
        total: 1200,
        items: [],
        options: [
          {
            id: 'opt-a',
            name: 'Option A – Root Canal & Crown',
            description: 'Preserve natural tooth structure',
            subtotal: 1200,
            discount_amount: 0,
            tax_amount: 0,
            total: 1200,
            items: [
              {
                id: 'it-1',
                procedure_name: 'Root Canal Treatment',
                tooth_number: 16,
                quantity: 1,
                unit_price: 700,
                discount_amount: 0,
                tax_amount: 0,
                line_total: 700,
              },
              {
                id: 'it-2',
                procedure_name: 'Ceramic Crown',
                tooth_number: 16,
                quantity: 1,
                unit_price: 500,
                discount_amount: 0,
                tax_amount: 0,
                line_total: 500,
              },
            ],
          },
          {
            id: 'opt-b',
            name: 'Option B – Extraction',
            description: 'Surgical extraction of tooth 16',
            subtotal: 300,
            discount_amount: 0,
            tax_amount: 0,
            total: 300,
            items: [
              {
                id: 'it-3',
                procedure_name: 'Surgical Extraction',
                tooth_number: 16,
                quantity: 1,
                unit_price: 300,
                discount_amount: 0,
                tax_amount: 0,
                line_total: 300,
              },
            ],
          },
        ],
        notes: 'Two options presented for tooth 16',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    await renderSection();

    expect(container.textContent).toContain('DTQ-2026-00002');

    const viewBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('View'),
    );
    expect(viewBtn).toBeTruthy();

    await act(async () => {
      viewBtn?.click();
    });

    // Check modal contents
    expect(container.textContent).toContain('Quotation #DTQ-2026-00002');
    expect(container.textContent).toContain('Presented Treatment Options (2)');
    expect(container.textContent).toContain('Option A – Root Canal & Crown');
    expect(container.textContent).toContain('Preserve natural tooth structure');
    expect(container.textContent).toContain('Option B – Extraction');
    expect(container.textContent).toContain('Surgical extraction of tooth 16');

    // Verify Phase 8C boundaries: strictly no Accept or Reject buttons
    const acceptBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.toLowerCase().includes('accept'),
    );
    expect(acceptBtn).toBeUndefined();
    const rejectBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.toLowerCase().includes('reject') || btn.textContent?.toLowerCase().includes('decline'),
    );
    expect(rejectBtn).toBeUndefined();
  });

  it('Phase 8A: displays existing draft quotations and opens details modal', async () => {
    mockApi.getEpisodeDentalQuotations.mockResolvedValueOnce([
      {
        id: 'quote-1',
        quotation_number: 'DTQ-2026-00001',
        patient_id: 'patient-1',
        patient_number: 'PAT-001',
        patient_name: 'John Doe',
        treatment_episode_id: 'episode-1',
        doctor_id: 'doc-1',
        doctor_name: 'Dr. Alice Endo',
        branch_id: 'branch-1',
        department_id: 'dept-1',
        status: 'DRAFT',
        currency: 'KES',
        subtotal: 850,
        discount_amount: 50,
        tax_amount: 0,
        total: 800,
        items: [
          {
            id: 'item-1',
            treatment_plan_item_id: planItemId,
            procedure_name: 'RCT and Ceramic Crown',
            tooth_number: 16,
            quantity: 1,
            unit_price: 850,
            discount_amount: 50,
            tax_amount: 0,
            line_total: 800,
          },
        ],
        notes: 'Initial quotation',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    await renderSection();

    expect(container.textContent).toContain('DTQ-2026-00001');
    expect(container.textContent).toContain('DRAFT');
    expect(container.textContent).toContain('Dr. Alice Endo');

    const viewBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('View'),
    );
    expect(viewBtn).toBeTruthy();

    await act(async () => {
      viewBtn?.click();
    });

    expect(container.textContent).toContain('Quotation #DTQ-2026-00001');
    expect(container.textContent).toContain('Grand Total');
  });

  it('Phase 8C: sends draft quotation to patient', async () => {
    mockApi.getEpisodeDentalQuotations.mockResolvedValueOnce([
      {
        id: 'quote-send-1',
        quotation_number: 'DTQ-2026-00010',
        patient_id: 'patient-1',
        patient_number: 'PAT-001',
        patient_name: 'John Doe',
        treatment_episode_id: 'episode-1',
        doctor_id: 'doc-1',
        doctor_name: 'Dr. Alice Endo',
        branch_id: 'branch-1',
        department_id: 'dept-1',
        status: 'DRAFT',
        currency: 'KES',
        subtotal: 1000,
        discount_amount: 0,
        tax_amount: 0,
        total: 1000,
        items: [
          {
            id: 'it-1',
            procedure_name: 'Tooth Restoration',
            quantity: 1,
            unit_price: 1000,
            discount_amount: 0,
            tax_amount: 0,
            line_total: 1000,
          },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    mockApi.sendDentalQuotation.mockResolvedValueOnce({
      id: 'quote-send-1',
      quotation_number: 'DTQ-2026-00010',
      status: 'SENT',
      sent_at: new Date().toISOString(),
    });

    await renderSection();

    expect(container.textContent).toContain('DTQ-2026-00010');
    const sendBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Send'),
    );
    expect(sendBtn).toBeTruthy();

    await act(async () => {
      sendBtn?.click();
    });

    expect(mockApi.sendDentalQuotation).toHaveBeenCalledWith('quote-send-1');
  });

  it('Phase 8C: allows patient/doctor to select option and accept quotation', async () => {
    mockApi.getEpisodeDentalQuotations.mockResolvedValueOnce([
      {
        id: 'quote-decide-1',
        quotation_number: 'DTQ-2026-00020',
        patient_id: 'patient-1',
        patient_number: 'PAT-001',
        patient_name: 'John Doe',
        treatment_episode_id: 'episode-1',
        doctor_id: 'doc-1',
        doctor_name: 'Dr. Alice Endo',
        branch_id: 'branch-1',
        department_id: 'dept-1',
        status: 'SENT',
        currency: 'KES',
        subtotal: 15000,
        discount_amount: 0,
        tax_amount: 0,
        total: 15000,
        items: [],
        options: [
          {
            id: 'opt-1',
            name: 'Option A: Root Canal Treatment',
            description: 'Preserve natural tooth',
            sequence: 1,
            subtotal: 15000,
            discount_amount: 0,
            tax_amount: 0,
            total: 15000,
            items: [
              {
                id: 'opt-it-1',
                procedure_name: 'Root Canal Treatment - Molar',
                tooth_number: 16,
                quantity: 1,
                unit_price: 15000,
                discount_amount: 0,
                tax_amount: 0,
                line_total: 15000,
              },
            ],
          },
          {
            id: 'opt-2',
            name: 'Option B: Extraction',
            description: 'Removal of tooth',
            sequence: 2,
            subtotal: 5000,
            discount_amount: 0,
            tax_amount: 0,
            total: 5000,
            items: [
              {
                id: 'opt-it-2',
                procedure_name: 'Tooth Extraction',
                tooth_number: 16,
                quantity: 1,
                unit_price: 5000,
                discount_amount: 0,
                tax_amount: 0,
                line_total: 5000,
              },
            ],
          },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    mockApi.acceptDentalQuotation.mockResolvedValueOnce({
      id: 'quote-decide-1',
      quotation_number: 'DTQ-2026-00020',
      status: 'ACCEPTED',
      selected_option_id: 'opt-1',
      selected_option_name: 'Option A: Root Canal Treatment',
      accepted_at: new Date().toISOString(),
      options: [
        {
          id: 'opt-1',
          name: 'Option A: Root Canal Treatment',
          total: 15000,
          items: [],
        },
      ],
    });

    await renderSection();

    // In table, status is SENT and action button says "Decide"
    expect(container.textContent).toContain('SENT');
    const decideBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Decide'),
    );
    expect(decideBtn).toBeTruthy();

    await act(async () => {
      decideBtn?.click();
    });

    // Check modal shows option selection
    expect(container.textContent).toContain('Quotation #DTQ-2026-00020');
    expect(container.textContent).toContain('Select an option below to accept');

    const acceptBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Accept Option'),
    );
    expect(acceptBtn).toBeTruthy();

    await act(async () => {
      acceptBtn?.click();
    });

    expect(mockApi.acceptDentalQuotation).toHaveBeenCalledWith('quote-decide-1', {
      selected_option_id: 'opt-1',
    });
  });

  it('Phase 8C: displays accepted quotation with green banner and synchronization status', async () => {
    mockApi.getEpisodeDentalQuotations.mockResolvedValueOnce([
      {
        id: 'quote-acc-1',
        quotation_number: 'DTQ-2026-00030',
        patient_id: 'patient-1',
        patient_number: 'PAT-001',
        patient_name: 'John Doe',
        treatment_episode_id: 'episode-1',
        doctor_id: 'doc-1',
        doctor_name: 'Dr. Alice Endo',
        branch_id: 'branch-1',
        department_id: 'dept-1',
        status: 'ACCEPTED',
        currency: 'KES',
        subtotal: 15000,
        discount_amount: 0,
        tax_amount: 0,
        total: 15000,
        selected_option_id: 'opt-1',
        selected_option_name: 'Option A: Root Canal Treatment',
        accepted_at: '2026-09-20T10:00:00Z',
        accepted_by: 'Dr. Alice Endo',
        items: [],
        options: [
          {
            id: 'opt-1',
            name: 'Option A: Root Canal Treatment',
            sequence: 1,
            subtotal: 15000,
            discount_amount: 0,
            tax_amount: 0,
            total: 15000,
            items: [],
          },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    await renderSection();

    expect(container.textContent).toContain('DTQ-2026-00030');
    expect(container.textContent).toContain('ACCEPTED');

    const viewBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('View'),
    );

    await act(async () => {
      viewBtn?.click();
    });

    expect(container.textContent).toContain('Patient Decision: Option Accepted');
    expect(container.textContent).toContain('Option A: Root Canal Treatment');
    expect(container.textContent).toContain('Procedures synchronized with active Treatment Plan');
  });

  it('Phase 8D: displays accepted treatment plan item and enables viewing/scheduling active clinical stages', async () => {
    mockApi.listDentalStages.mockResolvedValueOnce([
      {
        id: 'stage-act-1',
        episode_id: 'episode-1',
        plan_item_id: planItemId,
        stage_name: 'RCT and Ceramic Crown',
        sequence: 1,
        assigned_doctor_id: 'doc-1',
        assigned_doctor_name: 'Dr. Alice Endo',
        status: 'PLANNED',
        branch_id: 'branch-1',
        department_id: 'dept-1',
        patient_id: 'patient-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    await renderSection();

    // Verify item has ACCEPTED status
    expect(container.textContent).toContain('RCT and Ceramic Crown');
    expect(container.textContent).toContain('1 Accepted');
    expect(container.textContent).toContain('ACCEPTED');

    // Open stages drawer
    const stageBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Stages (1)'),
    );
    expect(stageBtn).toBeTruthy();

    await act(async () => {
      stageBtn?.click();
    });

    // Check Stage 1 is PLANNED with Schedule action and no Start action
    expect(container.textContent).toContain('RCT and Ceramic Crown');
    expect(container.textContent).toContain('Dr. Alice Endo');
    expect(container.textContent).toContain('PLANNED');

    const startBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Start',
    );
    expect(startBtn).toBeUndefined();

    const scheduleBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Schedule',
    );
    expect(scheduleBtn).toBeTruthy();
    expect(scheduleBtn?.hasAttribute('disabled')).toBe(false);
  });

  it('correctly routes stage creation to tooth-specific episode when multiple tooth episodes exist', async () => {
    const itemTooth12Id = '507f1f77bcf86cd799439012';
    const itemTooth24Id = '507f1f77bcf86cd799439024';

    const multiToothItems: DentalTreatmentPlanItem[] = [
      {
        id: itemTooth12Id,
        tooth_number: 12,
        procedure_name: 'Composite Restoration',
        priority: 'MEDIUM',
        status: 'ACCEPTED',
        estimated_cost: 250,
      },
      {
        id: itemTooth24Id,
        tooth_number: 24,
        procedure_name: 'Root Canal Treatment',
        priority: 'HIGH',
        status: 'ACCEPTED',
        estimated_cost: 750,
      },
    ];

    mockApi.listDentalStages.mockResolvedValue([]);
    mockApi.createDentalStage.mockResolvedValue({
      id: 'new-stage-1',
      episode_id: 'episode-tooth-12',
      plan_item_id: itemTooth12Id,
      stage_name: 'Composite / GIC Restoration & Curing',
      sequence: 1,
      assigned_doctor_id: 'doc-1',
      assigned_doctor_name: 'Dr. Anderson James',
      status: 'PLANNED',
      tooth_number: 12,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Mock patient episodes with distinct tooth numbers
    vi.spyOn(mockApi, 'listDentalStages').mockImplementation(async (epId: string) => {
      if (epId === 'episode-tooth-12') {
        return [
          {
            id: 'stage-12-1',
            episode_id: 'episode-tooth-12',
            plan_item_id: itemTooth12Id,
            stage_name: 'Composite / GIC Restoration & Curing',
            sequence: 1,
            assigned_doctor_id: 'doc-1',
            assigned_doctor_name: 'Dr. Anderson James',
            status: 'PLANNED',
            tooth_number: 12,
            branch_id: 'branch-1',
            department_id: 'dept-1',
            patient_id: 'patient-1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      }
      return [];
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalTreatmentPlanSection
            items={multiToothItems}
            teeth={[]}
            onChange={vi.fn()}
            patientId="patient-1"
            episodeId="episode-tooth-12"
            departmentId="dept-1"
          />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(container.textContent).toContain('Composite Restoration');
    expect(container.textContent).toContain('Root Canal Treatment');
  });

  it('1 & 5. One active episode for patient (e.g. Tooth #24) + procedure on Tooth #12 -> Add Stage uses existing episode', async () => {
    const onStartEpisode = vi.fn();
    const activeEpisode24 = {
      id: 'episode-dte-00002',
      episode_number: 'DTE-2026-00002',
      patient_id: 'patient-1',
      primary_tooth_number: 24,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as DentalTreatmentEpisodeResponse;

    mockApi.listDentalStages.mockResolvedValue([]);
    mockApi.listPatientDentalEpisodes.mockResolvedValue([activeEpisode24]);
    mockApi.createDentalStage.mockResolvedValue({
      id: 'stage-12-new',
      episode_id: 'episode-dte-00002',
      plan_item_id: planItemId,
      stage_name: 'Composite Restoration Prep',
      assigned_doctor_id: 'doc-1',
      status: 'PLANNED',
      tooth_number: 12,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const item12: DentalTreatmentPlanItem = {
      id: planItemId,
      tooth_number: 12,
      procedure_name: 'Composite Restoration',
      priority: 'HIGH',
      status: 'ACCEPTED',
      estimated_cost: 25000,
    };

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalTreatmentPlanSection
            items={[item12]}
            teeth={[]}
            onChange={vi.fn()}
            patientId="patient-1"
            episodes={[activeEpisode24]}
            departmentId="dept-1"
            onStartEpisode={onStartEpisode}
          />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // 1. Expand stages drawer
    const expandBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Stages available') || b.textContent?.includes('Stages ('),
    );
    expect(expandBtn).toBeTruthy();
    await act(async () => {
      expandBtn?.click();
    });

    // 2. Open inline Add Stage form
    const addStageBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Add Stage') || b.textContent?.includes('Manage Stages'),
    );
    expect(addStageBtn).toBeTruthy();
    await act(async () => {
      addStageBtn?.click();
    });

    // Verify episode context is shown in the inline form
    expect(container.textContent).toContain('DTE-2026-00002');

    // Fill in stage name
    const stageInput = container.querySelector<HTMLInputElement>('input[placeholder*="Crown Impression"]');
    if (stageInput) {
      await act(async () => {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(stageInput, 'Composite Restoration Prep');
        } else {
          stageInput.value = 'Composite Restoration Prep';
        }
        stageInput.dispatchEvent(new Event('input', { bubbles: true }));
        stageInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    // Submit stage
    const submitBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Add Stage' && b.className.includes('btnPrimary'),
    );
    expect(submitBtn).toBeTruthy();

    await act(async () => {
      submitBtn?.click();
    });

    // Verify stage was created on the existing active episode (DTE-2026-00002) and onStartEpisode was NOT called
    expect(onStartEpisode).not.toHaveBeenCalled();
    expect(mockApi.createDentalStage).toHaveBeenCalledWith(
      'episode-dte-00002',
      expect.objectContaining({
        plan_item_id: planItemId,
        stage_name: 'Composite Restoration Prep',
        tooth_number: 12,
      }),
    );
  });

  it('2 & 4. One active episode for patient + procedure on Tooth #24 -> Add Stage uses existing episode and never opens Create Episode', async () => {
    const onStartEpisode = vi.fn();
    const activeEpisode24 = {
      id: 'episode-dte-00002',
      episode_number: 'DTE-2026-00002',
      patient_id: 'patient-1',
      primary_tooth_number: 24,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as DentalTreatmentEpisodeResponse;

    mockApi.listDentalStages.mockResolvedValue([]);
    mockApi.listPatientDentalEpisodes.mockResolvedValue([activeEpisode24]);
    mockApi.createDentalStage.mockResolvedValue({
      id: 'stage-24-new',
      episode_id: 'episode-dte-00002',
      plan_item_id: planItemId,
      stage_name: 'Root Canal Obturation',
      assigned_doctor_id: 'doc-1',
      status: 'PLANNED',
      tooth_number: 24,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const item24: DentalTreatmentPlanItem = {
      id: planItemId,
      tooth_number: 24,
      procedure_name: 'Root Canal Treatment',
      priority: 'HIGH',
      status: 'ACCEPTED',
      estimated_cost: 35000,
    };

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalTreatmentPlanSection
            items={[item24]}
            teeth={[]}
            onChange={vi.fn()}
            patientId="patient-1"
            episodes={[activeEpisode24]}
            departmentId="dept-1"
            onStartEpisode={onStartEpisode}
          />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // 1. Expand stages drawer
    const expandBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Stages available') || b.textContent?.includes('Stages ('),
    );
    await act(async () => {
      expandBtn?.click();
    });

    // 2. Open inline Add Stage form
    const addStageBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Add Stage') || b.textContent?.includes('Manage Stages'),
    );
    await act(async () => {
      addStageBtn?.click();
    });

    const stageInput = container.querySelector<HTMLInputElement>('input[placeholder*="Crown Impression"]');
    if (stageInput) {
      await act(async () => {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(stageInput, 'Root Canal Obturation');
        } else {
          stageInput.value = 'Root Canal Obturation';
        }
        stageInput.dispatchEvent(new Event('input', { bubbles: true }));
        stageInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    const submitBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Add Stage' && b.className.includes('btnPrimary'),
    );
    await act(async () => {
      submitBtn?.click();
    });

    // Should use the existing active episode and NOT trigger onStartEpisode
    expect(onStartEpisode).not.toHaveBeenCalled();
    expect(mockApi.createDentalStage).toHaveBeenCalledWith(
      'episode-dte-00002',
      expect.objectContaining({
        plan_item_id: planItemId,
        stage_name: 'Root Canal Obturation',
        tooth_number: 24,
      }),
    );
  });

  it('3 & 6. No active episode (e.g. only COMPLETED episode) -> Create Episode flow is opened and no duplicate stage created', async () => {
    const onStartEpisode = vi.fn();
    const completedEpisode = {
      id: 'episode-tooth-12-closed',
      episode_number: 'DTE-2026-00001',
      patient_id: 'patient-1',
      primary_tooth_number: 12,
      status: 'COMPLETED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as DentalTreatmentEpisodeResponse;

    mockApi.listDentalStages.mockResolvedValue([]);
    mockApi.listPatientDentalEpisodes.mockResolvedValue([completedEpisode]);

    const item12: DentalTreatmentPlanItem = {
      id: planItemId,
      tooth_number: 12,
      procedure_name: 'Bridge',
      priority: 'HIGH',
      status: 'ACCEPTED',
      estimated_cost: 40000,
    };

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalTreatmentPlanSection
            items={[item12]}
            teeth={[]}
            onChange={vi.fn()}
            patientId="patient-1"
            episodes={[completedEpisode]}
            departmentId="dept-1"
            onStartEpisode={onStartEpisode}
          />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // 1. Expand stages drawer
    const expandBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Stages available') || b.textContent?.includes('Stages ('),
    );
    await act(async () => {
      expandBtn?.click();
    });

    // 2. Open inline Add Stage form
    const addStageBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Add Stage') || b.textContent?.includes('Manage Stages'),
    );
    await act(async () => {
      addStageBtn?.click();
    });

    // Because there is NO active episode, onStartEpisode should be triggered with Tooth #12
    expect(onStartEpisode).toHaveBeenCalledWith(12);
    expect(mockApi.createDentalStage).not.toHaveBeenCalled();
  });

  it('Quick Suggestions: displays suggestions dynamically based on Procedure Name, handles case-insensitivity, limits to 8, and populates form on click', async () => {
    const onChange = vi.fn();
    mockApi.listDentalStages.mockResolvedValue([]);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalTreatmentPlanSection
            items={[]}
            teeth={[]}
            onChange={onChange}
            patientId="patient-1"
            episodeId="episode-1"
            departmentId="dept-1"
          />
        </QueryClientProvider>,
      );
    });

    // 1. Reveal Add Treatment form
    const addBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Add Treatment') || b.textContent?.includes('+ Add Procedure'),
    );
    expect(addBtn).toBeTruthy();
    await act(async () => {
      addBtn?.click();
    });

    // 2. Empty Procedure Name: Quick Suggestions section is NOT displayed
    expect(container.querySelector('[data-testid="dental-quick-suggestions"]')).toBeNull();

    const procedureInput = container.querySelector('input[placeholder*="Composite Restoration"]') as HTMLInputElement;
    expect(procedureInput).not.toBeNull();

    // 3. Type "Crown" into Procedure Name input
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(procedureInput, 'Crown');
      procedureInput.dispatchEvent(new Event('input', { bubbles: true }));
      procedureInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Quick Suggestions are now visible
    const suggestionsSection = container.querySelector('[data-testid="dental-quick-suggestions"]');
    expect(suggestionsSection).not.toBeNull();
    expect(suggestionsSection?.textContent).toContain('Crown');
    expect(suggestionsSection?.textContent).not.toContain('Wisdom Tooth Extraction');
    expect(suggestionsSection?.textContent).not.toContain('Root Canal Treatment');

    // 4. Case-insensitive matching: type "root canal"
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(procedureInput, 'root canal');
      procedureInput.dispatchEvent(new Event('input', { bubbles: true }));
      procedureInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(suggestionsSection?.textContent).toContain('Root Canal Treatment');
    expect(suggestionsSection?.textContent).not.toContain('Crown');

    // 5. Clicking a suggestion populates Procedure Name and Est. Cost without creating treatment
    const rctChip = Array.from(suggestionsSection?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Root Canal Treatment'),
    );
    expect(rctChip).toBeTruthy();

    await act(async () => {
      rctChip?.click();
    });

    expect(procedureInput.value).toContain('Root Canal');
    const costInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(costInput).not.toBeNull();
    expect(Number(costInput.value)).toBeGreaterThan(0);
    // onChange not called until "Add Treatment" button is clicked
    expect(onChange).not.toHaveBeenCalled();

    // 6. Typing non-matching term shows "No matching procedures found."
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(procedureInput, 'NonExistentProcedure12345');
      procedureInput.dispatchEvent(new Event('input', { bubbles: true }));
      procedureInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('No matching procedures found.');
  });
});
