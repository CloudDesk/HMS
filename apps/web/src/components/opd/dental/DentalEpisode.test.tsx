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
  listDentalStages: vi.fn(),
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
import type { DentalTreatmentStageResponse } from '../../../api/opd';

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
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();

    mockApi.getDentalExamination.mockResolvedValue(mockExamData);
    mockApi.listPatientDentalEpisodes.mockResolvedValue([]);
    mockApi.getPatientToothHistory.mockResolvedValue([]);
    mockApi.listDentalStages.mockResolvedValue([]);

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

  it('1. Open Dental Examination with no tooth selected -> Episode hidden (even with active patient episode)', async () => {
    const mockEpisode: DentalTreatmentEpisodeResponse = {
      id: 'ep-24',
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
      primary_tooth_number: 24,
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

    // With no tooth selected, Episode indicator is completely hidden
    expect(container.textContent).not.toContain('Episode #DTE');
    expect(container.querySelector('[aria-label*="Episode Info"]')).toBeNull();
    expect(container.querySelector('[role="region"][aria-label*="Episode"]')).toBeNull();
  });

  it('2. Select a non-target tooth (Tooth #22 when episode is for #24) -> Episode hidden', async () => {
    const mockEpisode: DentalTreatmentEpisodeResponse = {
      id: 'ep-24',
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
      primary_tooth_number: 24,
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

    // Switch to Odontogram tab
    const odontogramTab = container.querySelector<HTMLButtonElement>('#dental-subtab-odontogram');
    await act(async () => {
      odontogramTab?.click();
    });

    // Select Tooth #22 (non-target tooth)
    const tooth22Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.includes('Tooth 22') || b.textContent?.includes('22'),
    );
    expect(tooth22Btn).toBeDefined();
    await act(async () => {
      tooth22Btn?.click();
    });

    // Episode indicator must remain hidden
    expect(container.querySelector('[aria-label*="Episode Info"]')).toBeNull();
    expect(container.querySelector('[role="region"][aria-label*="Episode"]')).toBeNull();
  });

  it('3. Select Episode target tooth (#24) -> Episode visible; deselect tooth -> Episode disappears immediately', async () => {
    const mockEpisode: DentalTreatmentEpisodeResponse = {
      id: 'ep-24',
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
      primary_tooth_number: 24,
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

    // Switch to Odontogram tab
    const odontogramTab = container.querySelector<HTMLButtonElement>('#dental-subtab-odontogram');
    await act(async () => {
      odontogramTab?.click();
    });

    // Select target Tooth #24
    const tooth24Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.includes('Tooth 24') || b.textContent?.includes('24'),
    );
    expect(tooth24Btn).toBeDefined();
    await act(async () => {
      tooth24Btn?.click();
    });

    // 1. Episode indicator is now visible
    const indicatorBtn = container.querySelector<HTMLButtonElement>('[aria-label*="Episode Info #DTE-2026-00002"]');
    expect(indicatorBtn).not.toBeNull();
    expect(indicatorBtn?.textContent).toContain('Episode');

    // 2. Click indicator to open popover
    await act(async () => {
      indicatorBtn?.click();
    });

    const popover = container.querySelector('[role="region"][aria-label="Dental Treatment Episode Details"]');
    expect(popover).not.toBeNull();
    expect(popover?.textContent).toContain('Episode #DTE-2026-00002');
    expect(popover?.textContent).toContain('Status:');
    expect(popover?.textContent).toContain('ACTIVE');
    expect(popover?.textContent).toContain('Primary Tooth:');
    expect(popover?.textContent).toContain('#24');

    // 3. Deselect tooth (reset finding) -> Episode must disappear immediately
    const resetBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reset'),
    );
    if (resetBtn) {
      await act(async () => {
        resetBtn.click();
      });
    } else {
      // If no finding to reset, select non-target tooth 23
      const tooth23Btn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.getAttribute('aria-label')?.includes('Tooth 23') || b.textContent?.includes('23'),
      );
      await act(async () => {
        tooth23Btn?.click();
      });
    }

    expect(container.querySelector('[aria-label*="Episode Info"]')).toBeNull();
    expect(container.querySelector('[role="region"][aria-label*="Episode"]')).toBeNull();
  });

  it('4. ACTIVE episode with incomplete stages -> displays correct progress and remaining stages', async () => {
    const mockEpisode: DentalTreatmentEpisodeResponse = {
      id: 'ep-24',
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
      primary_tooth_number: 24,
      diagnosis_name: 'Root Canal Treatment',
      status: 'ACTIVE',
      visit_ids: ['visit-1'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockStages: DentalTreatmentStageResponse[] = [
      {
        id: 'stage-1',
        episode_id: 'ep-24',
        plan_item_id: 'item-1',
        tooth_number: 24,
        stage_name: 'Access Opening & Pulpectomy',
        sequence: 1,
        assigned_doctor_id: 'doc-1',
        assigned_doctor_name: 'Dr. Smile',
        status: 'COMPLETED',
        branch_id: 'branch-1',
        department_id: 'dept-dental',
        patient_id: 'patient-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'stage-2',
        episode_id: 'ep-24',
        plan_item_id: 'item-1',
        tooth_number: 24,
        stage_name: 'Biomechanical Preparation & Canal Shaping',
        sequence: 2,
        assigned_doctor_id: 'doc-1',
        assigned_doctor_name: 'Dr. Smile',
        status: 'SCHEDULED',
        branch_id: 'branch-1',
        department_id: 'dept-dental',
        patient_id: 'patient-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'stage-3',
        episode_id: 'ep-24',
        plan_item_id: 'item-1',
        tooth_number: 24,
        stage_name: 'Obturation',
        sequence: 3,
        assigned_doctor_id: 'doc-1',
        assigned_doctor_name: 'Dr. Smile',
        status: 'PLANNED',
        branch_id: 'branch-1',
        department_id: 'dept-dental',
        patient_id: 'patient-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    mockApi.listPatientDentalEpisodes.mockResolvedValue([mockEpisode]);
    mockApi.listDentalStages.mockResolvedValue(mockStages);
    queryClient.setQueryData(opdKeys.patientDentalEpisodes('patient-123'), [mockEpisode]);
    queryClient.setQueryData(opdKeys.dentalStages('ep-24'), mockStages);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} patient={mockPatient} />
        </QueryClientProvider>,
      );
    });

    // Switch to Odontogram tab & select target tooth 24
    const odontogramTab = container.querySelector<HTMLButtonElement>('#dental-subtab-odontogram');
    await act(async () => {
      odontogramTab?.click();
    });

    const tooth24Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.includes('Tooth 24') || b.textContent?.includes('24'),
    );
    await act(async () => {
      tooth24Btn?.click();
    });

    const indicatorBtn = container.querySelector<HTMLButtonElement>('[aria-label*="Episode Info #DTE-2026-00002"]');
    expect(indicatorBtn).not.toBeNull();

    await act(async () => {
      indicatorBtn?.click();
    });

    const popover = container.querySelector('[role="region"][aria-label="Dental Treatment Episode Details"]');
    expect(popover).not.toBeNull();
    expect(popover?.textContent).toContain('Episode #DTE-2026-00002');
    expect(popover?.textContent).toContain('Status:');
    expect(popover?.textContent).toContain('ACTIVE');
    expect(popover?.textContent).toContain('Primary Tooth:');
    expect(popover?.textContent).toContain('#24');
    expect(popover?.textContent).toContain('Progress:');
    expect(popover?.textContent).toContain('1 / 3 stages');
    expect(popover?.textContent).toContain('2 stages remaining');
  });

  it('5. COMPLETED episode -> popover displays "✓ All treatment completed"', async () => {
    const mockEpisode: DentalTreatmentEpisodeResponse = {
      id: 'ep-24',
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
      primary_tooth_number: 24,
      diagnosis_name: 'Root Canal Treatment',
      status: 'COMPLETED',
      visit_ids: ['visit-1'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockStages: DentalTreatmentStageResponse[] = [
      {
        id: 'stage-1',
        episode_id: 'ep-24',
        plan_item_id: 'item-1',
        tooth_number: 24,
        stage_name: 'Access Opening',
        sequence: 1,
        assigned_doctor_id: 'doc-1',
        assigned_doctor_name: 'Dr. Smile',
        status: 'COMPLETED',
        branch_id: 'branch-1',
        department_id: 'dept-dental',
        patient_id: 'patient-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    mockApi.listPatientDentalEpisodes.mockResolvedValue([mockEpisode]);
    mockApi.listDentalStages.mockResolvedValue(mockStages);
    queryClient.setQueryData(opdKeys.patientDentalEpisodes('patient-123'), [mockEpisode]);
    queryClient.setQueryData(opdKeys.dentalStages('ep-24'), mockStages);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} patient={mockPatient} />
        </QueryClientProvider>,
      );
    });

    const odontogramTab = container.querySelector<HTMLButtonElement>('#dental-subtab-odontogram');
    await act(async () => {
      odontogramTab?.click();
    });

    const tooth24Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.includes('Tooth 24') || b.textContent?.includes('24'),
    );
    await act(async () => {
      tooth24Btn?.click();
    });

    const indicatorBtn = container.querySelector<HTMLButtonElement>('[aria-label*="Episode Info #DTE-2026-00002"]');
    await act(async () => {
      indicatorBtn?.click();
    });

    const popover = container.querySelector('[role="region"][aria-label="Dental Treatment Episode Details"]');
    expect(popover).not.toBeNull();
    expect(popover?.textContent).toContain('Status:');
    expect(popover?.textContent).toContain('COMPLETED');
    expect(popover?.textContent).toContain('✓ All treatment completed');
  });

  it('6. ACTIVE episode with no stages yet -> popover shows "Progress: No treatment stages yet"', async () => {
    const mockEpisode: DentalTreatmentEpisodeResponse = {
      id: 'ep-24',
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
      primary_tooth_number: 24,
      diagnosis_name: 'Root Canal Treatment',
      status: 'ACTIVE',
      visit_ids: ['visit-1'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockApi.listPatientDentalEpisodes.mockResolvedValue([mockEpisode]);
    mockApi.listDentalStages.mockResolvedValue([]);
    queryClient.setQueryData(opdKeys.patientDentalEpisodes('patient-123'), [mockEpisode]);
    queryClient.setQueryData(opdKeys.dentalStages('ep-24'), []);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} patient={mockPatient} />
        </QueryClientProvider>,
      );
    });

    const odontogramTab = container.querySelector<HTMLButtonElement>('#dental-subtab-odontogram');
    await act(async () => {
      odontogramTab?.click();
    });

    const tooth24Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.includes('Tooth 24') || b.textContent?.includes('24'),
    );
    await act(async () => {
      tooth24Btn?.click();
    });

    const indicatorBtn = container.querySelector<HTMLButtonElement>('[aria-label*="Episode Info #DTE-2026-00002"]');
    await act(async () => {
      indicatorBtn?.click();
    });

    const popover = container.querySelector('[role="region"][aria-label="Dental Treatment Episode Details"]');
    expect(popover).not.toBeNull();
    expect(popover?.textContent).toContain('Status:');
    expect(popover?.textContent).toContain('ACTIVE');
    expect(popover?.textContent).toContain('Progress: No treatment stages yet');
  });

  it('7. Displays read-only previous visit findings when selecting tooth with historical findings', async () => {
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

    // Switch to Odontogram tab
    const odontogramTab = container.querySelector<HTMLButtonElement>('#dental-subtab-odontogram');
    await act(async () => {
      odontogramTab?.click();
    });

    const tooth16Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.includes('Tooth 16') || b.textContent?.includes('16'),
    );
    expect(tooth16Btn).toBeDefined();

    await act(async () => {
      tooth16Btn?.click();
    });

    expect(container.textContent).toContain('Previous Visit Findings');
    expect(container.textContent).toContain('Dr. Historical Smile');
    expect(container.textContent).toContain('Deep caries approaching pulp chamber');
  });

  it('8. Episode popover opens on hover and closes on mouse leave or click outside', async () => {
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

    // Switch to Odontogram tab & select target tooth 22
    const odontogramTab = container.querySelector<HTMLButtonElement>('#dental-subtab-odontogram');
    await act(async () => {
      odontogramTab?.click();
    });

    const tooth22Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.includes('Tooth 22') || b.textContent?.includes('22'),
    );
    await act(async () => {
      tooth22Btn?.click();
    });

    const indicatorBtn = container.querySelector<HTMLButtonElement>('[aria-label*="Episode Info #DTE-2026-00001"]');
    expect(indicatorBtn).not.toBeNull();

    // Hover to show
    await act(async () => {
      indicatorBtn?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      indicatorBtn?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    });
    expect(container.querySelector('[role="region"][aria-label="Dental Treatment Episode Details"]')).not.toBeNull();

    // Mouse leave to hide
    await act(async () => {
      indicatorBtn?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
      indicatorBtn?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    });
    expect(container.querySelector('[role="region"][aria-label="Dental Treatment Episode Details"]')).toBeNull();

    // Click to pin open
    await act(async () => {
      indicatorBtn?.click();
    });
    expect(container.querySelector('[role="region"][aria-label="Dental Treatment Episode Details"]')).not.toBeNull();

    // Click outside to close
    await act(async () => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(container.querySelector('[role="region"][aria-label="Dental Treatment Episode Details"]')).toBeNull();
  });
});
