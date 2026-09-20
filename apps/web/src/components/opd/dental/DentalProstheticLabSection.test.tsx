// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DentalTreatmentPlanSection } from './DentalTreatmentPlanSection';
import { DentalProstheticLabSection } from './DentalProstheticLabSection';
import { DentalProstheticLabModal } from './DentalProstheticLabModal';
import { DentalStageScheduleModal } from './DentalStageScheduleModal';
import type {
  DentalTreatmentPlanItem,
  DentalTreatmentStageResponse,
  DentalProstheticLabOrderResponse,
} from '../../../api/opd';

const mockApi = vi.hoisted(() => ({
  listDentalStages: vi.fn(),
  createDentalStage: vi.fn(),
  assignDoctorToDentalStage: vi.fn(),
  updateDentalStageStatus: vi.fn(),
  deleteDentalStage: vi.fn(),
  getDentalStageAppointment: vi.fn(),
  getEpisodeDentalLabOrders: vi.fn(),
  getDentalLabOrder: vi.fn(),
  createDentalLabOrder: vi.fn(),
  updateDentalLabOrderStatus: vi.fn(),
  scheduleDentalStage: vi.fn(),
  rescheduleDentalStage: vi.fn(),
}));

const mockDoctorsApi = vi.hoisted(() => ({
  list: vi.fn(),
  availableSlots: vi.fn(),
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

const PLAN_ITEM_ID = '607f1f77bcf86cd799439011';

const mockStages: DentalTreatmentStageResponse[] = [
  {
    id: 'stage-1',
    episode_id: 'ep-123',
    plan_item_id: PLAN_ITEM_ID,
    tooth_number: 16,
    stage_name: 'Crown Measurement & Impression',
    sequence: 1,
    assigned_doctor_id: 'doc-1',
    assigned_doctor_name: 'Dr. Alice Endo',
    status: 'IN_PROGRESS',
    branch_id: 'branch-1',
    department_id: 'dept-1',
    patient_id: 'pat-123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'stage-2',
    episode_id: 'ep-123',
    plan_item_id: PLAN_ITEM_ID,
    tooth_number: 16,
    stage_name: 'Crown Delivery & Cementation',
    sequence: 2,
    assigned_doctor_id: 'doc-2',
    assigned_doctor_name: 'Dr. Bob Prostho',
    status: 'PLANNED',
    prosthetic_lab_order_id: 'lab-ord-1',
    branch_id: 'branch-1',
    department_id: 'dept-1',
    patient_id: 'pat-123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const mockLabOrders: DentalProstheticLabOrderResponse[] = [
  {
    id: 'lab-ord-1',
    order_number: 'DPL-2026-00001',
    patient_id: 'pat-123',
    treatment_episode_id: 'ep-123',
    treatment_stage_id: 'stage-2',
    treatment_plan_item_id: PLAN_ITEM_ID,
    tooth_number: 16,
    prosthetic_type: 'CROWN',
    description: 'Zirconia Crown Shade A2',
    requested_by: 'doc-2',
    requested_by_name: 'Dr. Bob Prostho',
    requested_at: new Date().toISOString(),
    status: 'ORDERED',
    branch_id: 'branch-1',
    department_id: 'dept-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const mockItems: DentalTreatmentPlanItem[] = [
  {
    id: PLAN_ITEM_ID,
    tooth_number: 16,
    procedure_name: 'Full Ceramic Crown',
    priority: 'ROUTINE',
    estimated_cost: 500,
    status: 'IN_PROGRESS',
  },
];

const setNativeValue = (element: HTMLElement, value: string) => {
  const valueSetter = Object.getOwnPropertyDescriptor(element.constructor.prototype, 'value')?.set;
  if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    (element as HTMLInputElement).value = value;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('Phase 5B: Dental Prosthetic Lab UI', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0 },
      },
    });

    mockApi.listDentalStages.mockResolvedValue(mockStages);
    mockApi.getEpisodeDentalLabOrders.mockResolvedValue(mockLabOrders);
    mockApi.getDentalLabOrder.mockImplementation((id: string) =>
      Promise.resolve(mockLabOrders.find((o) => o.id === id) ?? null)
    );
    mockApi.createDentalLabOrder.mockResolvedValue({
      id: 'lab-ord-new',
      order_number: 'DPL-2026-00002',
      patient_id: 'pat-123',
      treatment_episode_id: 'ep-123',
      treatment_stage_id: 'stage-1',
      tooth_number: 16,
      prosthetic_type: 'CROWN',
      description: 'Zirconia crown test',
      requested_by: 'user-1',
      requested_at: new Date().toISOString(),
      status: 'ORDERED',
      branch_id: 'branch-1',
      department_id: 'dept-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mockDoctorsApi.list.mockResolvedValue({ data: [], meta: { total: 0 } });
    mockDoctorsApi.availableSlots.mockResolvedValue({
      doctor_id: 'doc-1',
      date: '2026-10-30',
      is_available: true,
      unavailable_reason: null,
      slots: [
        { start_time: '10:00', end_time: '10:30', available: true, is_available: true },
      ],
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('renders "+ Lab Order" button for stage without lab order and badge for stage with lab order', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalTreatmentPlanSection
            items={mockItems}
            teeth={[]}
            onChange={vi.fn()}
            episodeId="ep-123"
            patientId="pat-123"
          />
        </QueryClientProvider>
      );
    });

    // Wait for queries to resolve
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // Expand stages drawer
    const stagesToggle = container.querySelector('button[title*="treatment stages"]') as HTMLButtonElement;
    expect(stagesToggle).not.toBeNull();
    await act(async () => {
      stagesToggle.click();
      await new Promise((r) => setTimeout(r, 20));
    });

    // Stage 1 does not have a lab order -> should have Lab Order create button
    const createLabBtns = container.querySelectorAll('[data-testid="stage-create-lab-order-btn"]');
    expect(createLabBtns.length).toBeGreaterThan(0);

    // Stage 2 has lab order -> should have lab order badge with DPL-2026-00001
    const labBadge = container.querySelector('[data-testid="stage-lab-order-badge"]');
    expect(labBadge).not.toBeNull();
    expect(labBadge?.textContent).toContain('DPL-2026-00001');
    expect(labBadge?.textContent).toContain('CROWN');
  });

  it('opens create modal when clicking "+ Lab Order" and allows creating a lab order', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalTreatmentPlanSection
            items={mockItems}
            teeth={[]}
            onChange={vi.fn()}
            episodeId="ep-123"
            patientId="pat-123"
          />
        </QueryClientProvider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // Open stages drawer
    const stagesToggle = container.querySelector('button[title*="treatment stages"]') as HTMLButtonElement;
    expect(stagesToggle).not.toBeNull();
    await act(async () => {
      stagesToggle.click();
      await new Promise((r) => setTimeout(r, 20));
    });

    // Click "+ Lab Order" on Stage 1
    const createLabBtn = container.querySelector('[data-testid="stage-create-lab-order-btn"]') as HTMLButtonElement;
    expect(createLabBtn).not.toBeNull();
    await act(async () => {
      createLabBtn.click();
    });

    // Verify modal is open
    expect(container.textContent).toContain('Create Dental Lab Order');
    expect(container.textContent).toContain('Stage 1: Crown Measurement & Impression');

    // Fill description and submit
    const descTextarea = container.querySelector('textarea#lab-description') as HTMLTextAreaElement;
    expect(descTextarea).not.toBeNull();

    await act(async () => {
      descTextarea.value = 'Custom Shade A3.5 High Translucency';
      descTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      descTextarea.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Submit form
    const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Create Lab Order')
    );
    expect(submitBtn).toBeDefined();

    await act(async () => {
      submitBtn?.click();
    });

    expect(mockApi.createDentalLabOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        patient_id: 'pat-123',
        treatment_episode_id: 'ep-123',
        treatment_stage_id: 'stage-1',
        tooth_number: 16,
        prosthetic_type: 'CROWN',
        status: 'ORDERED',
      })
    );
  });

  it('allows viewing existing lab order details in modal', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalProstheticLabModal
            isOpen={true}
            onClose={vi.fn()}
            existingOrderId="lab-ord-1"
          />
        </QueryClientProvider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(mockApi.getDentalLabOrder).toHaveBeenCalledWith('lab-ord-1');
    expect(container.textContent).toContain('Dental Prosthetic Lab Order');
    expect(container.textContent).toContain('DPL-2026-00001');
    expect(container.textContent).toContain('CROWN');
    expect(container.textContent).toContain('Tooth #16');
    expect(container.textContent).toContain('Zirconia Crown Shade A2');
  });

  it('renders standalone DentalProstheticLabSection with orders for the episode', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalProstheticLabSection
            episodeId="ep-123"
            patientId="pat-123"
            stages={mockStages}
          />
        </QueryClientProvider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(container.textContent).toContain('Dental Prosthetic Lab Orders');
    expect(container.textContent).toContain('DPL-2026-00001');
    expect(container.textContent).toContain('Tooth #16');
    expect(container.textContent).toContain('Stage 2: Crown Delivery & Cementation');
  });

  it('does not render create lab order button in disabled/read-only mode', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalTreatmentPlanSection
            items={mockItems}
            teeth={[]}
            onChange={vi.fn()}
            episodeId="ep-123"
            patientId="pat-123"
            disabled={true}
          />
        </QueryClientProvider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // Expand stages drawer if present
    const stagesToggle = container.querySelector('button[title*="treatment stages"]') as HTMLButtonElement;
    if (stagesToggle) {
      await act(async () => {
        stagesToggle.click();
      });
    }

    const createLabBtns = container.querySelectorAll('[data-testid="stage-create-lab-order-btn"]');
    expect(createLabBtns.length).toBe(0);
  });

  it('renders manufacturing pipeline stepper and allows advancing status with remarks', async () => {
    mockApi.updateDentalLabOrderStatus.mockResolvedValue({
      ...mockLabOrders[0],
      status: 'RECEIVED',
      status_remarks: 'Impression received at lab',
      received_at: new Date().toISOString(),
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalProstheticLabModal
            isOpen={true}
            onClose={vi.fn()}
            existingOrderId="lab-ord-1"
          />
        </QueryClientProvider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // Stepper labels
    expect(container.textContent).toContain('Ordered');
    expect(container.textContent).toContain('Received');
    expect(container.textContent).toContain('In Progress');
    expect(container.textContent).toContain('Quality Check');
    expect(container.textContent).toContain('Ready');

    // Workflow Progression action section
    expect(container.textContent).toContain('Workflow Progression');
    const advanceBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Mark Received at Lab')
    );
    expect(advanceBtn).toBeDefined();

    // Enter remarks
    const remarksInput = container.querySelector('input#transition-remarks') as HTMLInputElement;
    expect(remarksInput).not.toBeNull();

    await act(async () => {
      setNativeValue(remarksInput, 'Impression received at lab');
    });

    // Click advance button
    await act(async () => {
      advanceBtn?.click();
    });

    expect(mockApi.updateDentalLabOrderStatus).toHaveBeenCalledWith('lab-ord-1', {
      status: 'RECEIVED',
      remarks: 'Impression received at lab',
    });
  });

  it('handles cancellation workflow requiring cancellation reason', async () => {
    mockApi.updateDentalLabOrderStatus.mockResolvedValue({
      ...mockLabOrders[0],
      status: 'CANCELLED',
      cancellation_reason: 'Change in treatment plan',
      cancelled_at: new Date().toISOString(),
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalProstheticLabModal
            isOpen={true}
            onClose={vi.fn()}
            existingOrderId="lab-ord-1"
          />
        </QueryClientProvider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // Click "Cancel Order" trigger
    const cancelTriggerBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cancel Order')
    );
    expect(cancelTriggerBtn).toBeDefined();

    await act(async () => {
      cancelTriggerBtn?.click();
    });

    // Verify cancellation input is displayed
    expect(container.textContent).toContain('Cancellation Reason');
    const cancelReasonTextarea = container.querySelector('textarea#cancel-reason') as HTMLTextAreaElement;
    expect(cancelReasonTextarea).not.toBeNull();

    // Confirm button should be disabled if reason is empty
    const confirmCancelBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Confirm Cancellation')
    );
    expect(confirmCancelBtn).toBeDefined();
    expect(confirmCancelBtn?.disabled).toBe(true);

    // Enter cancellation reason
    await act(async () => {
      setNativeValue(cancelReasonTextarea, 'Change in treatment plan');
    });

    expect(confirmCancelBtn?.disabled).toBe(false);

    // Confirm cancellation
    await act(async () => {
      confirmCancelBtn?.click();
    });

    expect(mockApi.updateDentalLabOrderStatus).toHaveBeenCalledWith('lab-ord-1', {
      status: 'CANCELLED',
      cancellation_reason: 'Change in treatment plan',
      remarks: undefined,
    });
  });

  it('renders READY status as terminal without action controls and shows ready banner', async () => {
    mockApi.getDentalLabOrder.mockResolvedValue({
      ...mockLabOrders[0],
      status: 'READY',
      ready_at: new Date().toISOString(),
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalProstheticLabModal
            isOpen={true}
            onClose={vi.fn()}
            existingOrderId="lab-ord-1"
          />
        </QueryClientProvider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(container.textContent).toContain('Order Ready');
    expect(container.textContent).toContain('Prosthesis manufactured, QC verified, and ready for fitting.');
    expect(container.textContent).not.toContain('Workflow Progression');
    expect(container.textContent).not.toContain('Cancel Order');
  });

  it('Phase 5D: displays pending banner and disables stage completion when linked lab order is not READY', async () => {
    // Stage 1 is IN_PROGRESS with linked lab order in ORDERED state
    const stageWithPendingLab: DentalTreatmentStageResponse[] = [
      {
        id: 'stage-pending',
        episode_id: 'ep-123',
        plan_item_id: PLAN_ITEM_ID,
        tooth_number: 16,
        stage_name: 'Crown Delivery Stage',
        sequence: 1,
        assigned_doctor_id: 'doc-1',
        assigned_doctor_name: 'Dr. Alice Endo',
        status: 'IN_PROGRESS',
        prosthetic_lab_order_id: 'lab-ord-1',
        branch_id: 'branch-1',
        department_id: 'dept-1',
        patient_id: 'pat-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const pendingLabOrders: DentalProstheticLabOrderResponse[] = [
      {
        id: 'lab-ord-1',
        order_number: 'DPL-2026-00001',
        patient_id: 'pat-123',
        treatment_episode_id: 'ep-123',
        treatment_stage_id: 'stage-pending',
        treatment_plan_item_id: PLAN_ITEM_ID,
        tooth_number: 16,
        prosthetic_type: 'CROWN',
        description: 'Zirconia Crown Shade A2',
        requested_by: 'doc-1',
        requested_by_name: 'Dr. Alice Endo',
        requested_at: new Date().toISOString(),
        status: 'IN_PROGRESS',
        branch_id: 'branch-1',
        department_id: 'dept-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    mockApi.listDentalStages.mockResolvedValue(stageWithPendingLab);
    mockApi.getEpisodeDentalLabOrders.mockResolvedValue(pendingLabOrders);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalTreatmentPlanSection
            items={mockItems}
            teeth={[]}
            onChange={vi.fn()}
            episodeId="ep-123"
            patientId="pat-123"
          />
        </QueryClientProvider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // Expand stages drawer
    const stagesToggle = container.querySelector('button[title*="treatment stages"]') as HTMLButtonElement;
    expect(stagesToggle).not.toBeNull();
    await act(async () => {
      stagesToggle.click();
    });

    // Lab processing banner should be rendered
    const pendingBanner = container.querySelector('[data-testid="stage-lab-pending-banner"]');
    expect(pendingBanner).not.toBeNull();
    expect(pendingBanner?.textContent).toContain('Lab Processing:');
    expect(pendingBanner?.textContent).toContain('DPL-2026-00001');
    expect(pendingBanner?.textContent).toContain('IN PROGRESS');
    expect(pendingBanner?.textContent).toContain('Awaiting READY before clinical completion');

    // Complete button should be disabled because lab is IN_PROGRESS
    const completeBtn = container.querySelector('[data-testid="stage-1-complete-btn"]') as HTMLButtonElement;
    expect(completeBtn).not.toBeNull();
    expect(completeBtn.disabled).toBe(true);

    // Pending notice badge should be visible
    const pendingNotice = container.querySelector('[data-testid="stage-lab-pending-notice"]');
    expect(pendingNotice).not.toBeNull();
    expect(pendingNotice?.textContent).toContain('Lab: IN_PROGRESS');
  });

  it('Phase 5D: displays ready banner and enables stage completion when linked lab order is READY', async () => {
    // Stage 1 is IN_PROGRESS with linked lab order in READY state
    const stageWithReadyLab: DentalTreatmentStageResponse[] = [
      {
        id: 'stage-ready',
        episode_id: 'ep-123',
        plan_item_id: PLAN_ITEM_ID,
        tooth_number: 16,
        stage_name: 'Crown Delivery Stage',
        sequence: 1,
        assigned_doctor_id: 'doc-1',
        assigned_doctor_name: 'Dr. Alice Endo',
        status: 'IN_PROGRESS',
        prosthetic_lab_order_id: 'lab-ord-ready',
        branch_id: 'branch-1',
        department_id: 'dept-1',
        patient_id: 'pat-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const readyLabOrders: DentalProstheticLabOrderResponse[] = [
      {
        id: 'lab-ord-ready',
        order_number: 'DPL-2026-00088',
        patient_id: 'pat-123',
        treatment_episode_id: 'ep-123',
        treatment_stage_id: 'stage-ready',
        treatment_plan_item_id: PLAN_ITEM_ID,
        tooth_number: 16,
        prosthetic_type: 'CROWN',
        description: 'Zirconia Crown Shade A2',
        requested_by: 'doc-1',
        requested_by_name: 'Dr. Alice Endo',
        requested_at: new Date().toISOString(),
        ready_at: new Date().toISOString(),
        status: 'READY',
        branch_id: 'branch-1',
        department_id: 'dept-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    mockApi.listDentalStages.mockResolvedValue(stageWithReadyLab);
    mockApi.getEpisodeDentalLabOrders.mockResolvedValue(readyLabOrders);
    mockApi.updateDentalStageStatus.mockResolvedValue({
      ...stageWithReadyLab[0],
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalTreatmentPlanSection
            items={mockItems}
            teeth={[]}
            onChange={vi.fn()}
            episodeId="ep-123"
            patientId="pat-123"
          />
        </QueryClientProvider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // Expand stages drawer
    const stagesToggle = container.querySelector('button[title*="treatment stages"]') as HTMLButtonElement;
    expect(stagesToggle).not.toBeNull();
    await act(async () => {
      stagesToggle.click();
    });

    // Ready banner should be rendered
    const readyBanner = container.querySelector('[data-testid="stage-lab-ready-banner"]');
    expect(readyBanner).not.toBeNull();
    expect(readyBanner?.textContent).toContain('Prosthetic Ready:');
    expect(readyBanner?.textContent).toContain('DPL-2026-00088');
    expect(readyBanner?.textContent).toContain('ready for clinical fitting & cementation');
    expect(readyBanner?.textContent).toContain('Next Clinical Step:');

    // Complete button should now be ENABLED
    const completeBtn = container.querySelector('[data-testid="stage-1-complete-btn"]') as HTMLButtonElement;
    expect(completeBtn).not.toBeNull();
    expect(completeBtn.disabled).toBe(false);

    // Clicking complete triggers update status
    await act(async () => {
      completeBtn.click();
    });

    expect(mockApi.updateDentalStageStatus).toHaveBeenCalledWith('stage-ready', {
      status: 'COMPLETED',
    });
  });

  it('Phase 7B: enables Schedule button on PLANNED fitting stage when lab order is READY', async () => {
    const plannedFittingStages: DentalTreatmentStageResponse[] = [
      {
        id: 'stage-fitting',
        episode_id: 'ep-123',
        plan_item_id: PLAN_ITEM_ID,
        tooth_number: 16,
        stage_name: 'Crown Fitting & Cementation',
        sequence: 1,
        assigned_doctor_id: 'doc-2',
        assigned_doctor_name: 'Dr. Bob Prostho',
        status: 'PLANNED',
        prosthetic_lab_order_id: 'lab-ord-ready-2',
        branch_id: 'branch-1',
        department_id: 'dept-1',
        patient_id: 'pat-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const readyLabOrders: DentalProstheticLabOrderResponse[] = [
      {
        id: 'lab-ord-ready-2',
        order_number: 'DPL-2026-00099',
        patient_id: 'pat-123',
        treatment_episode_id: 'ep-123',
        treatment_stage_id: 'stage-fitting',
        treatment_plan_item_id: PLAN_ITEM_ID,
        tooth_number: 16,
        prosthetic_type: 'CROWN',
        description: 'Ceramic Crown Shade A2',
        requested_by: 'doc-1',
        requested_by_name: 'Dr. Alice Endo',
        requested_at: new Date().toISOString(),
        ready_at: new Date().toISOString(),
        status: 'READY',
        branch_id: 'branch-1',
        department_id: 'dept-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    mockApi.listDentalStages.mockResolvedValue(plannedFittingStages);
    mockApi.getEpisodeDentalLabOrders.mockResolvedValue(readyLabOrders);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalTreatmentPlanSection
            items={mockItems}
            teeth={[]}
            onChange={vi.fn()}
            episodeId="ep-123"
            patientId="pat-123"
          />
        </QueryClientProvider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // Expand stages drawer
    const stagesToggle = container.querySelector('button[title*="treatment stages"]') as HTMLButtonElement;
    expect(stagesToggle).not.toBeNull();
    await act(async () => {
      stagesToggle.click();
    });

    // Verify Schedule button is rendered and enabled
    const scheduleBtn = container.querySelector('[data-testid="stage-1-schedule-btn"]') as HTMLButtonElement;
    expect(scheduleBtn).not.toBeNull();
    expect(scheduleBtn.disabled).toBe(false);

    // Clicking opens schedule modal
    await act(async () => {
      scheduleBtn.click();
    });

    const modal = document.querySelector('[role="dialog"][aria-label="Schedule Stage Appointment"]');
    expect(modal).not.toBeNull();
  });

  it('12. Phase 7C: DentalStageScheduleModal passes patientId to availableSlots and disables conflicting slots with label', async () => {
    mockDoctorsApi.availableSlots.mockResolvedValue({
      doctor_id: 'doc-2',
      date: '2026-10-30',
      is_available: true,
      unavailable_reason: null,
      slots: [
        { start_time: '10:00', end_time: '10:30', available: false, is_available: false, reason: 'Patient has conflicting appointment' },
        { start_time: '11:00', end_time: '11:30', available: true, is_available: true },
      ],
    });

    const fittingStage: DentalTreatmentStageResponse = {
      id: 'stage-fitting-1',
      episode_id: 'ep-123',
      plan_item_id: PLAN_ITEM_ID,
      tooth_number: 16,
      stage_name: 'Crown Fitting',
      sequence: 2,
      assigned_doctor_id: 'doc-2',
      assigned_doctor_name: 'Dr. Bob Prostho',
      status: 'PLANNED',
      prosthetic_lab_order_id: 'lab-ord-1',
      branch_id: 'branch-1',
      department_id: 'dept-1',
      patient_id: 'pat-123',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalStageScheduleModal
            stage={fittingStage}
            onClose={vi.fn()}
          />
        </QueryClientProvider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // Check doctorsApi.availableSlots was called with patientId
    expect(mockDoctorsApi.availableSlots).toHaveBeenCalledWith(
      'doc-2',
      expect.any(String),
      expect.any(Number),
      'pat-123',
      undefined,
    );

    // Slot 10:00 should show Patient Conflict and be disabled
    const buttons = Array.from(document.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('10:00'),
    );
    expect(buttons.length).toBeGreaterThan(0);
    const slot1000Btn = buttons[0] as HTMLButtonElement;
    expect(slot1000Btn.disabled).toBe(true);
    expect(slot1000Btn.textContent).toContain('Patient Conflict');

    // Slot 11:00 should be enabled
    const slot1100Btns = Array.from(document.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('11:00'),
    );
    expect(slot1100Btns.length).toBeGreaterThan(0);
    const slot1100Btn = slot1100Btns[0] as HTMLButtonElement;
    expect(slot1100Btn.disabled).toBe(false);
  });
});

