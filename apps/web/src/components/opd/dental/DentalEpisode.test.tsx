// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OpdDentalExaminationTab } from './OpdDentalExaminationTab';
import { opdKeys } from '../../../hooks/opd/useOpd';
import type {
  DentalTreatmentEpisodeResponse,
  HistoricalToothFinding,
  OpdDentalExaminationResponse,
} from '../../../api/opd';

const mockApi = vi.hoisted(() => ({
  getDentalExamination: vi.fn(),
  saveDentalExaminationDraft: vi.fn(),
  completeDentalExamination: vi.fn(),
  listPatientDentalEpisodes: vi.fn(),
  getDentalEpisode: vi.fn(),
  createDentalEpisode: vi.fn(),
  linkVisitToDentalEpisode: vi.fn(),
  updateDentalEpisodeStatus: vi.fn(),
  getPatientToothHistory: vi.fn(),
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

vi.mock('../../../api/useSettings', () => ({
  useCurrencyFormatter: () => (val: number) => `$${val.toFixed(2)}`,
}));

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({ user: { roles: [{ code: 'SUPER_ADMIN' }], permissions: [] } }),
}));

import type { PatientResponse } from '../../../api/patients';

const mockPatient = {
  id: 'patient-123',
  patient_number: 'P-12345',
  first_name: 'Jane',
  last_name: 'Doe',
  date_of_birth: '1990-05-15',
  gender: 'FEMALE' as const,
  phone: '1234567890',
  primary_branch_id: 'branch-1',
  status: 'ACTIVE' as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as unknown as PatientResponse;

const mockExamData: OpdDentalExaminationResponse = {
  id: 'exam-1',
  visit_id: 'visit-1',
  patient_id: 'patient-123',
  patient_number: 'P-12345',
  patient_name: 'Jane Doe',
  doctor_id: 'doctor-1',
  doctor_name: 'Dr. Smile',
  branch_id: 'branch-1',
  department_id: 'dept-dental',
  status: 'DRAFT',
  dental_history: null,
  soft_tissue: null,
  teeth: [],
  treatment_plan_items: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('Dental Treatment Episode & Cumulative Odontogram UI Tests', () => {
  let queryClient: QueryClient;
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();

    mockApi.getDentalExamination.mockResolvedValue(mockExamData);
    mockApi.listPatientDentalEpisodes.mockResolvedValue([]);
    mockApi.getPatientToothHistory.mockResolvedValue([]);

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    queryClient.setQueryData(opdKeys.dentalExamination('visit-1'), mockExamData);

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    queryClient.clear();
  });

  it('1. When no tooth is selected, no episode context or start episode action is shown', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} patient={mockPatient} />
        </QueryClientProvider>,
      );
    });

    expect(container.textContent).not.toContain('Episode #DTE');
    expect(container.textContent).not.toContain('Primary Tooth #');
    expect(container.querySelector('[role="region"][aria-label="Dental Treatment Episode"]')).toBeNull();
    expect(container.querySelector('[role="region"][aria-label*="Episode"]')).toBeNull();

    // Select Tooth #25 -> Start Treatment Episode action appears specifically for Tooth #25
    const tooth25Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.includes('Tooth 25') || b.textContent === '25',
    );
    expect(tooth25Btn).toBeDefined();
    await act(async () => {
      tooth25Btn?.click();
    });
    expect(container.textContent).toContain('Tooth #25');
    expect(container.textContent).toContain('No treatment episode has been started for this tooth');

    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Start Treatment Episode'),
    );
    expect(startBtn).toBeDefined();

    await act(async () => {
      startBtn?.click();
    });

    // Check modal opened with tooth 25 prefilled
    expect(container.textContent).toContain('Start Dental Treatment Episode');
    const toothInput = container.querySelector<HTMLInputElement>('#ep-tooth');
    expect(toothInput?.value).toBe('25');
  });

  it('2. Renders active episode banner and linked status when selecting primary tooth #16', async () => {
    const mockEpisode: DentalTreatmentEpisodeResponse = {
      id: 'ep-1',
      episode_number: 'DTE-2026-00001',
      patient_id: 'patient-123',
      patient_number: 'P-12345',
      patient_name: 'Jane Doe',
      originating_visit_id: 'visit-1',
      originating_visit_number: 'VIS-001',
      primary_doctor_id: 'doc-1',
      primary_doctor_name: 'Dr. Smile',
      branch_id: 'branch-1',
      department_id: 'dept-dental',
      primary_tooth_number: 16,
      diagnosis_name: 'Irreversible Pulpitis',
      status: 'ACTIVE',
      visit_ids: ['visit-1'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockApi.listPatientDentalEpisodes.mockResolvedValue([mockEpisode]);
    queryClient.setQueryData(opdKeys.patientDentalEpisodes('patient-123'), [mockEpisode]);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} patient={mockPatient} />
        </QueryClientProvider>,
      );
    });

    // When no tooth selected -> no episode
    expect(container.textContent).not.toContain('Episode #DTE-2026-00001');

    // Select Tooth #16 -> episode appears
    const tooth16Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.includes('Tooth 16') || b.textContent === '16',
    );
    expect(tooth16Btn).toBeDefined();

    await act(async () => {
      tooth16Btn?.click();
    });

    expect(container.textContent).toContain('Episode #DTE-2026-00001');
    expect(container.textContent).toContain('ACTIVE');
    expect(container.textContent).toContain('Primary Tooth #16');
    expect(container.textContent).toContain('Irreversible Pulpitis');
    expect(container.textContent).toContain('Dr. Smile');
    expect(container.textContent).toContain('1 visit in journey');
  });

  it('3. Renders notice to link current visit when selecting tooth with active episode not yet linked', async () => {
    const mockEpisode: DentalTreatmentEpisodeResponse = {
      id: 'ep-1',
      episode_number: 'DTE-2026-00001',
      patient_id: 'patient-123',
      patient_number: 'P-12345',
      patient_name: 'Jane Doe',
      originating_visit_id: 'visit-0',
      originating_visit_number: 'VIS-000',
      primary_doctor_id: 'doc-1',
      primary_doctor_name: 'Dr. Smile',
      branch_id: 'branch-1',
      department_id: 'dept-dental',
      primary_tooth_number: 16,
      diagnosis_name: 'Root Canal Journey',
      status: 'ACTIVE',
      visit_ids: ['visit-0'], // Does not contain visit-1
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockApi.listPatientDentalEpisodes.mockResolvedValue([mockEpisode]);
    queryClient.setQueryData(opdKeys.patientDentalEpisodes('patient-123'), [mockEpisode]);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} patient={mockPatient} />
        </QueryClientProvider>,
      );
    });

    const tooth16Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.includes('Tooth 16') || b.textContent === '16',
    );
    await act(async () => {
      tooth16Btn?.click();
    });

    expect(container.textContent).toContain('Active Dental Episode #DTE-2026-00001');
    expect(container.textContent).toContain('Link This Visit to Episode');
  });

  it('4. Displays read-only previous visit findings when selecting tooth with historical findings', async () => {
    const mockHistory: HistoricalToothFinding[] = [
      {
        tooth_number: 16,
        dentition: 'PERMANENT',
        status: 'PRESENT',
        surfaces: ['OCCLUSAL', 'MESIAL'],
        conditions: ['CARIOUS', 'PULPITIC'],
        notes: 'Deep caries approaching pulp chamber',
        visit_id: 'visit-0',
        visit_number: 'VIS-000',
        doctor_id: 'doc-1',
        doctor_name: 'Dr. Historical Smile',
        recorded_at: '2026-09-01T10:00:00Z',
      },
    ];

    mockApi.getPatientToothHistory.mockResolvedValue(mockHistory);
    queryClient.setQueryData(opdKeys.patientToothHistory('patient-123', 'visit-1'), mockHistory);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} patient={mockPatient} />
        </QueryClientProvider>,
      );
    });

    // Find tooth 16 button
    const tooth16Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.includes('Tooth 16') || b.textContent?.includes('16'),
    );
    expect(tooth16Btn).toBeDefined();

    await act(async () => {
      tooth16Btn?.click();
    });

    // Verify Previous Visit Findings appears in the ToothExaminationPanel
    expect(container.textContent).toContain('Previous Visit Findings');
    expect(container.textContent).toContain('Dr. Historical Smile');
    expect(container.textContent).toContain('Deep caries approaching pulp chamber');
    expect(container.textContent).toContain('Caries / Decay');
    expect(container.textContent).toContain('Pulpitis / RCT Needed');
  });

  it('5. Strictly selected-tooth driven: no tooth -> no episode; select #22 -> episode #22 shown; select #25 -> #22 hidden & active conflict notice shown; select #22 -> restored', async () => {
    const mockEpisode: DentalTreatmentEpisodeResponse = {
      id: 'ep-22',
      episode_number: 'DTE-2026-00001',
      patient_id: 'patient-123',
      patient_number: 'P-12345',
      patient_name: 'Jane Doe',
      originating_visit_id: 'visit-1',
      originating_visit_number: 'VIS-001',
      primary_doctor_id: 'doc-1',
      primary_doctor_name: 'Dr. Anderson James',
      branch_id: 'branch-1',
      department_id: 'dept-dental',
      primary_tooth_number: 22,
      diagnosis_name: 'Root Canal Treatment',
      status: 'ACTIVE',
      visit_ids: ['visit-1'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockApi.listPatientDentalEpisodes.mockResolvedValue([mockEpisode]);
    queryClient.setQueryData(opdKeys.patientDentalEpisodes('patient-123'), [mockEpisode]);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} patient={mockPatient} />
        </QueryClientProvider>,
      );
    });

    // 1. Initial state (no tooth selected): NO episode context is visible
    expect(container.textContent).not.toContain('Episode #DTE-2026-00001');
    expect(container.textContent).not.toContain('Primary Tooth #22');

    // 2. Select Tooth #22 -> episode banner is visible
    const tooth22Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.includes('Tooth 22') || b.textContent === '22',
    );
    expect(tooth22Btn).toBeDefined();

    await act(async () => {
      tooth22Btn?.click();
    });

    expect(container.textContent).toContain('Episode #DTE-2026-00001');
    expect(container.textContent).toContain('Primary Tooth #22');
    expect(container.textContent).toContain('Root Canal Treatment');

    // 3. Select Tooth #25 -> #22 episode banner is HIDDEN; #25 shows active episode conflict notice (since #22 is ACTIVE)
    const tooth25Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.includes('Tooth 25') || b.textContent === '25',
    );
    expect(tooth25Btn).toBeDefined();

    await act(async () => {
      tooth25Btn?.click();
    });

    expect(container.textContent).not.toContain('Primary Tooth #25');
    expect(container.textContent).toContain('An active treatment episode already exists for this patient');
    expect(container.textContent).toContain('FDI #25');

    // 4. Select Tooth #23 -> #22 episode card remains HIDDEN; #23 shows active conflict notice
    const tooth23Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.includes('Tooth 23') || b.textContent === '23',
    );
    expect(tooth23Btn).toBeDefined();

    await act(async () => {
      tooth23Btn?.click();
    });

    expect(container.textContent).toContain('An active treatment episode already exists for this patient');
    expect(container.textContent).toContain('FDI #23');

    // 5. Select Tooth #22 again -> episode banner reappears
    await act(async () => {
      tooth22Btn?.click();
    });

    expect(container.textContent).toContain('Episode #DTE-2026-00001');
    expect(container.textContent).toContain('Primary Tooth #22');
    expect(container.textContent).toContain('FDI #22');
  });

  it('6. Allows creating new treatment episode for #23 when #22 is COMPLETED, and #22 episode does not leak into #25 or #23', async () => {
    const mockCompletedEpisode: DentalTreatmentEpisodeResponse = {
      id: 'ep-22',
      episode_number: 'DTE-2026-00001',
      patient_id: 'patient-123',
      patient_number: 'P-12345',
      patient_name: 'Jane Doe',
      originating_visit_id: 'visit-0',
      originating_visit_number: 'VIS-000',
      primary_doctor_id: 'doc-1',
      primary_doctor_name: 'Dr. Smile',
      branch_id: 'branch-1',
      department_id: 'dept-dental',
      primary_tooth_number: 22,
      diagnosis_name: 'Root Canal Treatment',
      status: 'COMPLETED',
      visit_ids: ['visit-0'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockApi.listPatientDentalEpisodes.mockResolvedValue([mockCompletedEpisode]);
    queryClient.setQueryData(opdKeys.patientDentalEpisodes('patient-123'), [mockCompletedEpisode]);

    const createdEpisode23: DentalTreatmentEpisodeResponse = {
      id: 'ep-23',
      episode_number: 'DTE-2026-00002',
      patient_id: 'patient-123',
      patient_number: 'P-12345',
      patient_name: 'Jane Doe',
      originating_visit_id: 'visit-1',
      originating_visit_number: 'VIS-001',
      primary_doctor_id: 'doc-1',
      primary_doctor_name: 'Dr. Smile',
      branch_id: 'branch-1',
      department_id: 'dept-dental',
      primary_tooth_number: 23,
      diagnosis_name: 'Caries Management',
      status: 'ACTIVE',
      visit_ids: ['visit-1'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockApi.createDentalEpisode = vi.fn().mockResolvedValue(createdEpisode23);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} patient={mockPatient} />
        </QueryClientProvider>,
      );
    });

    // 1. Initial state (no tooth selected) -> no episode context
    expect(container.textContent).not.toContain('Episode #DTE-2026-00001');

    // 2. Select #22 -> confirm DTE-2026-00001 is COMPLETED and primary tooth #22
    const tooth22Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.includes('Tooth 22') || b.textContent === '22',
    );
    expect(tooth22Btn).toBeDefined();
    await act(async () => {
      tooth22Btn?.click();
    });
    expect(container.textContent).toContain('Episode #DTE-2026-00001');
    expect(container.textContent).toContain('COMPLETED');
    expect(container.textContent).toContain('Primary Tooth #22');

    // 3. Select #25 -> #22 episode is NOT shown; Start Treatment Episode is shown for Tooth #25
    const tooth25Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.includes('Tooth 25') || b.textContent === '25',
    );
    expect(tooth25Btn).toBeDefined();
    await act(async () => {
      tooth25Btn?.click();
    });

    expect(container.textContent).not.toContain('Episode #DTE-2026-00001');
    expect(container.textContent).toContain('Tooth #25');
    expect(container.textContent).toContain('No treatment episode has been started for this tooth');
    expect(container.textContent).toContain('Start Treatment Episode');

    // 4. Select #23 -> #22 episode is NOT shown; Start Treatment Episode is shown for Tooth #23
    const tooth23Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.includes('Tooth 23') || b.textContent === '23',
    );
    expect(tooth23Btn).toBeDefined();
    await act(async () => {
      tooth23Btn?.click();
    });

    expect(container.textContent).not.toContain('Episode #DTE-2026-00001');
    expect(container.textContent).toContain('Tooth #23');
    expect(container.textContent).toContain('No treatment episode has been started for this tooth');

    // 5. Click Start Treatment Episode on #23 and submit
    const startEpisodeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Start Treatment Episode'),
    );
    expect(startEpisodeBtn).toBeDefined();

    await act(async () => {
      startEpisodeBtn?.click();
    });
    expect(container.textContent).toContain('Start Dental Treatment Episode');

    // Confirm tooth input is prefilled with 23
    const toothInput = container.querySelector<HTMLInputElement>('#ep-tooth');
    expect(toothInput?.value).toBe('23');

    // Submit the modal form
    const createSubmitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Create Episode'),
    );
    await act(async () => {
      createSubmitBtn?.click();
    });

    // 6. Confirm new episode created and update query cache
    queryClient.setQueryData(opdKeys.patientDentalEpisodes('patient-123'), [
      mockCompletedEpisode,
      createdEpisode23,
    ]);

    // 7. Select #22 again -> confirm DTE-2026-00001 remains COMPLETED and unchanged
    await act(async () => {
      tooth22Btn?.click();
    });
    expect(container.textContent).toContain('Episode #DTE-2026-00001');
    expect(container.textContent).toContain('COMPLETED');
    expect(container.textContent).toContain('Primary Tooth #22');

    // 8. Select #23 again -> confirm new #23 episode DTE-2026-00002 is displayed (ACTIVE)
    await act(async () => {
      tooth23Btn?.click();
    });
    expect(container.textContent).toContain('Episode #DTE-2026-00002');
    expect(container.textContent).toContain('ACTIVE');
    expect(container.textContent).toContain('Primary Tooth #23');
  });
});
