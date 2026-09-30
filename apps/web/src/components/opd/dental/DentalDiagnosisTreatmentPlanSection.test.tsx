// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DentalDiagnosisTreatmentPlanSection } from './DentalDiagnosisTreatmentPlanSection';
import type { OpdDentalExaminationResponse } from '../../../api/opd';
import type { ServiceResponse } from '../../../api/services';

const mockExam: OpdDentalExaminationResponse = {
  id: 'exam-1',
  visit_id: 'visit-1',
  patient_id: 'patient-1',
  patient_number: 'P001',
  patient_name: 'John Doe',
  doctor_id: 'doc-1',
  doctor_name: 'Dr. Dental',
  branch_id: 'branch-1',
  department_id: 'dept-dental',
  status: 'DRAFT',
  teeth: [
    {
      tooth_number: 16,
      dentition: 'PERMANENT',
      status: 'PRESENT',
      surfaces: ['OCCLUSAL'],
      conditions: ['CARIOUS'],
    },
  ],
  treatment_plan_items: [
    {
      id: 'plan-1',
      tooth_number: 16,
      procedure_name: 'Composite Restoration',
      status: 'PROPOSED',
      estimated_cost: 150,
      surfaces: ['OCCLUSAL'],
    },
  ],
  dental_history: {
    chief_complaint: 'Toothache',
    medical_alerts: ['Hypertension'],
  },
  soft_tissue: null,
  created_at: '2026-09-29T10:00:00Z',
  updated_at: '2026-09-29T10:00:00Z',
};

const mockDepartmentServices: ServiceResponse[] = [
  {
    id: 'svc-composite-123',
    code: 'DENT-COMP-01',
    name: 'Composite Restoration - Posterior',
    service_type: 'PROCEDURE',
    category: 'Dental',
    description: null,
    department_id: 'dept-dental',
    standard_price: 250,
    default_duration_minutes: 30,
    booking_capacity: 1,
    requires_bed: false,
    requires_consent: false,
    requires_advance_deposit: false,
    minimum_advance_deposit_amount: null,
    status: 'ACTIVE',
    created_at: '2026-09-29T00:00:00Z',
    updated_at: '2026-09-29T00:00:00Z',
    created_by: null,
    updated_by: null,
  },
];

vi.mock('../../../hooks/opd/useOpd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../hooks/opd/useOpd')>();
  return {
    ...actual,
    useOpdDentalExamination: () => ({
      data: mockExam,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }),
    useSaveOpdDentalExaminationDraft: () => ({
      mutateAsync: vi.fn().mockResolvedValue(mockExam),
      isPending: false,
    }),
    usePatientDentalEpisodes: () => ({
      data: [],
      isLoading: false,
    }),
    useCreateDentalEpisode: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
    useDentalStages: () => ({
      data: [],
      isLoading: false,
    }),
    useDentalQuotations: () => ({
      data: [],
      isLoading: false,
    }),
    useDentalStageAppointment: () => ({
      data: null,
      isLoading: false,
    }),
  };
});

vi.mock('../../../api/useSettings', () => ({
  useCurrencyFormatter: () => (val: number) => `KES ${val.toFixed(2)}`,
}));

describe('DentalDiagnosisTreatmentPlanSection Component', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    queryClient.clear();
  });

  it('renders the Clinical Relationship card and tooth-linked compact table', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalDiagnosisTreatmentPlanSection
            visitId="visit-1"
            canEdit={true}
            departmentServices={mockDepartmentServices}
            diagnoses={[
              {
                code: 'K02.1',
                name: 'Caries of dentine',
                category: 'Dental Caries',
                tooth_number: 16,
              },
            ]}
          />
        </QueryClientProvider>,
      );
    });

    expect(container.textContent).toContain('Diagnosis & Treatment Plan');
    expect(container.textContent).toContain('Linked by FDI tooth number');
    expect(container.textContent).toContain('#16');
    expect(container.textContent).toContain('Carious');
    expect(container.textContent).toContain('K02.1 — Caries of dentine');
    expect(container.textContent).toContain('Composite Restoration');
  });

  it('renders bottom action strip with summary metrics and action buttons', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalDiagnosisTreatmentPlanSection
            visitId="visit-1"
            canEdit={true}
            departmentServices={mockDepartmentServices}
            diagnoses={[]}
          />
        </QueryClientProvider>,
      );
    });

    expect(container.textContent).toContain('Examined Teeth: 1');
    expect(container.textContent).toContain('Procedures: 1');
    expect(container.textContent).toContain('Est. Total: KES 150.00');
    expect(container.textContent).toContain('1 Alert');
    expect(container.textContent).toContain('Save Draft');
    expect(container.textContent).toContain('Next: Prescription');
  });

  it('passes service catalogue procedure services into procedure selection', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalDiagnosisTreatmentPlanSection
            visitId="visit-1"
            canEdit={true}
            departmentServices={mockDepartmentServices}
            diagnoses={[]}
          />
        </QueryClientProvider>,
      );
    });

    // The DentalTreatmentPlanSection is embedded
    expect(container.textContent).toContain('Dental Treatment Plan');
    expect(container.textContent).toContain('+ Add Treatment');

    // Click + Add Treatment to reveal procedure choosing form
    const addTreatmentBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('+ Add Treatment'),
    );
    expect(addTreatmentBtn).toBeTruthy();

    await act(async () => {
      addTreatmentBtn?.click();
    });

    expect(container.textContent).toContain('Add Dental Treatment Procedure');
    expect(container.textContent).toContain('Service Catalogue');
    expect(container.textContent).toContain('Composite Restoration - Posterior (KES 250.00)');
  });

  it('allows removing diagnosis directly from the compact table row', async () => {
    const onRemoveDiagnosis = vi.fn();

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DentalDiagnosisTreatmentPlanSection
            visitId="visit-1"
            canEdit={true}
            departmentServices={mockDepartmentServices}
            onRemoveDiagnosis={onRemoveDiagnosis}
            diagnoses={[
              {
                code: 'K02.1',
                name: 'Caries of dentine',
                category: 'Dental Caries',
                tooth_number: 16,
              },
            ]}
          />
        </QueryClientProvider>,
      );
    });

    const removeBtn = container.querySelector('button[title*="Remove diagnosis K02.1"]') as HTMLButtonElement;
    expect(removeBtn).not.toBeNull();

    await act(async () => {
      removeBtn.click();
    });

    expect(onRemoveDiagnosis).toHaveBeenCalledWith('K02.1', 16);
  });
});
