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

  it('1. Renders empty episode notice and button to start treatment episode when none exists', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} patient={mockPatient} />
        </QueryClientProvider>,
      );
    });

    expect(container.textContent).toContain('No active multi-visit treatment episode for this patient');
    expect(container.textContent).toContain('Start Treatment Episode');

    // Click Start Treatment Episode button
    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Start Treatment Episode'),
    );
    expect(startBtn).toBeDefined();

    await act(async () => {
      startBtn?.click();
    });

    // Check modal opened
    expect(container.textContent).toContain('Start Dental Treatment Episode');
    expect(container.textContent).toContain('Primary Affected Tooth (FDI Number, Optional)');
    expect(container.textContent).toContain('Primary Diagnosis / Clinical Focus');
  });

  it('2. Renders active episode banner and linked status when episode is linked to visit', async () => {
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

    expect(container.textContent).toContain('Episode #DTE-2026-00001');
    expect(container.textContent).toContain('ACTIVE');
    expect(container.textContent).toContain('Primary Tooth #16');
    expect(container.textContent).toContain('Irreversible Pulpitis');
    expect(container.textContent).toContain('Dr. Smile');
    expect(container.textContent).toContain('1 visit in journey');
  });

  it('3. Renders notice to link current visit when patient has active episode not yet linked', async () => {
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
});
