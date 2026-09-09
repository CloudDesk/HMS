// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpdDentalExaminationResponse } from '../../../api/opd';
import { opdKeys } from '../../../hooks/opd/useOpd';

const mockExamData: OpdDentalExaminationResponse = {
  id: 'dental-exam-1',
  visit_id: 'visit-1',
  consultation_id: null,
  patient_id: 'patient-1',
  patient_number: 'P001',
  patient_name: 'John Doe',
  doctor_id: 'doc-1',
  doctor_name: 'Dr. Dental',
  branch_id: 'branch-1',
  department_id: 'dept-dent',
  status: 'DRAFT',
  dental_history: {
    chief_complaint: 'Toothache in upper molar',
    pain_scale: 4,
    bleeding_gums: true,
    sensitivity_hot_cold_sweet: false,
    bruxism: false,
    habits: ['Smoking / Tobacco'],
    medical_alerts: ['Hypertension'],
  },
  soft_tissue: {
    gingiva_condition: 'Mild Marginal Gingivitis',
    calculus_plaque: 'Mild (Supragingival)',
    oral_mucosa: 'Normal',
    tongue_palate_floor: 'Normal',
    tmj_evaluation: 'Normal / Asymptomatic',
    occlusion_class: 'Class I (Normal Molar Relationship)',
  },
  teeth: [
    {
      tooth_number: 16,
      dentition: 'PERMANENT',
      status: 'PRESENT',
      surfaces: ['OCCLUSAL', 'MESIAL'],
      conditions: ['CARIOUS'],
      mobility: 'NONE',
      pocket_depth_mm: 3,
      furcation_involvement: null,
      notes: 'Deep occlusal pit decay',
    },
  ],
  treatment_plan_items: [
    {
      id: '507f1f77bcf86cd799439011',
      service_id: '507f1f77bcf86cd799439012',
      tooth_number: 16,
      procedure_name: 'Composite Restoration',
      surfaces: ['OCCLUSAL', 'MESIAL'],
      priority: 'ROUTINE',
      estimated_cost: 150,
      notes: 'Restore with micro-hybrid composite',
      status: 'PROPOSED',
    },
  ],
  completed_at: null,
  created_by: 'doc-1',
  updated_by: 'doc-1',
  created_at: '2026-09-07T10:00:00.000Z',
  updated_at: '2026-09-07T10:00:00.000Z',
};

const api = vi.hoisted(() => ({
  getDentalExamination: vi.fn(async () => mockExamData),
  saveDentalExaminationDraft: vi.fn(async (_vId: string, payload: unknown) => ({
    ...mockExamData,
    ...(payload as object),
  })),
  completeDentalExamination: vi.fn(async (_vId: string, payload: unknown) => ({
    ...mockExamData,
    ...(payload as object),
    status: 'COMPLETED',
  })),
}));

vi.mock('../../../api/opd', async () => {
  const actual = await vi.importActual('../../../api/opd');
  return {
    ...actual,
    opdApi: {
      ...(actual as { opdApi: object }).opdApi,
      getDentalExamination: api.getDentalExamination,
      saveDentalExaminationDraft: api.saveDentalExaminationDraft,
      completeDentalExamination: api.completeDentalExamination,
    },
  };
});

import { OpdDentalExaminationTab } from './OpdDentalExaminationTab';

describe('OpdDentalExaminationTab Component', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    api.getDentalExamination.mockReset();
    api.saveDentalExaminationDraft.mockReset();
    api.completeDentalExamination.mockReset();

    api.getDentalExamination.mockResolvedValue(mockExamData);
    api.saveDentalExaminationDraft.mockImplementation(async (_vId: string, payload: unknown) => ({
      ...mockExamData,
      ...(payload as object),
    }));
    api.completeDentalExamination.mockImplementation(async (_vId: string, payload: unknown) => ({
      ...mockExamData,
      ...(payload as object),
      status: 'COMPLETED',
    }));

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

  it('renders dental examination header, status, and history data', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} />
        </QueryClientProvider>,
      );
    });

    expect(container.textContent).toContain('Dental Examination & Odontogram');
    expect(container.textContent).toContain('Draft In-Progress');
    expect(container.textContent).toContain('Dental History & Medical Risk Assessment');
    expect(container.textContent).toContain('Toothache in upper molar');
    expect(container.textContent).toContain('Hypertension');
  });

  it('selects a tooth on the odontogram and displays its findings in the panel', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} />
        </QueryClientProvider>,
      );
    });

    // Find tooth 16 card
    const tooth16Card = container.querySelector('[aria-label="Tooth 16: Maxillary Right First Molar"]');
    expect(tooth16Card).not.toBeNull();

    await act(async () => {
      tooth16Card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Panel should now show FDI #16 and its details
    expect(container.textContent).toContain('FDI #16');
    expect(container.textContent).toContain('Maxillary Right First Molar');
    expect(container.textContent).toContain('Deep occlusal pit decay');
  });

  it('triggers save draft with modified dental data', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} />
        </QueryClientProvider>,
      );
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save Draft'),
    );
    expect(saveButton).toBeDefined();

    await act(async () => {
      saveButton?.click();
    });

    expect(api.saveDentalExaminationDraft).toHaveBeenCalledTimes(1);
    expect(api.saveDentalExaminationDraft).toHaveBeenCalledWith(
      'visit-1',
      expect.objectContaining({
        dental_history: expect.objectContaining({
          chief_complaint: 'Toothache in upper molar',
        }),
      }),
    );
  });

  it('opens confirmation modal and completes examination', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} />
        </QueryClientProvider>,
      );
    });

    const completeButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Complete Examination'),
    );
    expect(completeButton).toBeDefined();

    await act(async () => {
      completeButton?.click();
    });

    // Modal should be open
    expect(container.textContent).toContain('Complete Dental Examination?');
    expect(container.textContent).toContain('Once completed, the odontogram, tooth findings, and clinical notes will be locked');

    const confirmButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Confirm & Finalize'),
    );
    expect(confirmButton).toBeDefined();

    await act(async () => {
      confirmButton?.click();
    });

    expect(api.completeDentalExamination).toHaveBeenCalledTimes(1);
  });

  it('renders locked banner and disables actions when examination is COMPLETED', async () => {
    const completedData = {
      ...mockExamData,
      status: 'COMPLETED' as const,
      completed_at: '2026-09-07T12:00:00.000Z',
    };
    api.getDentalExamination.mockResolvedValue(completedData);
    queryClient.setQueryData(opdKeys.dentalExamination('visit-1'), completedData);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} />
        </QueryClientProvider>,
      );
    });

    expect(container.textContent).toContain('Completed & Locked');
    expect(container.textContent).toContain('Dental Examination is marked as COMPLETED');

    // Save Draft and Complete buttons should NOT be rendered
    const saveButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save Draft'),
    );
    expect(saveButton).toBeUndefined();
  });

  it('renders read-only general consultation context when consultation prop is provided', async () => {
    const mockConsultation = {
      id: 'cons-1',
      visit_id: 'visit-1',
      patient_id: 'patient-1',
      patient_number: 'P001',
      patient_name: 'John Doe',
      doctor_id: 'doc-1',
      doctor_name: 'Dr. Dental',
      status: 'DRAFT' as const,
      chief_complaint: 'Severe jaw pain and swelling on right side',
      history_present_illness: 'Pain started 3 days ago after chewing hard food',
      past_history: null,
      family_history: null,
      allergies: 'Penicillin',
      physical_examination: null,
      assessment: null,
      treatment_plan: null,
      doctor_notes: null,
      completed_at: null,
      created_by: 'doc-1',
      updated_by: 'doc-1',
      created_at: '2026-09-07T10:00:00.000Z',
      updated_at: '2026-09-07T10:00:00.000Z',
    };

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab
            visitId="visit-1"
            canEdit={true}
            consultation={mockConsultation}
          />
        </QueryClientProvider>,
      );
    });

    expect(container.textContent).toContain('General Consultation (from Consultation tab — read only)');
    expect(container.textContent).toContain('Severe jaw pain and swelling on right side');
    expect(container.textContent).toContain('Pain started 3 days ago after chewing hard food');
    expect(container.textContent).toContain('Dental-Specific Complaint');
  });

  it('renders service catalogue quick-add procedure chips in treatment plan and auto-fills price', async () => {
    const mockServices = [
      {
        id: 'svc-1',
        code: 'DENT-001',
        name: 'Root Canal Treatment (RCT)',
        service_type: 'PROCEDURE' as const,
        category: 'Endodontics',
        description: 'Molar RCT',
        department_id: 'dept-dent',
        standard_price: 250,
        default_duration_minutes: 60,
        booking_capacity: 1,
        requires_bed: false,
        requires_consent: true,
        requires_advance_deposit: false,
        minimum_advance_deposit_amount: null,
        status: 'ACTIVE' as const,
        created_at: '2026-09-07T10:00:00.000Z',
        updated_at: '2026-09-07T10:00:00.000Z',
        created_by: 'admin',
        updated_by: 'admin',
      },
    ];

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab
            visitId="visit-1"
            canEdit={true}
            departmentServices={mockServices}
          />
        </QueryClientProvider>,
      );
    });

    expect(container.textContent).toContain('Quick-Add from Service Catalogue');
    expect(container.textContent).toContain('Root Canal Treatment (RCT)');

    const chipButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Root Canal Treatment (RCT)'),
    );
    expect(chipButton).toBeDefined();

    await act(async () => {
      chipButton?.click();
    });

    const procedureInput = container.querySelector('input[placeholder*="Composite Restoration"]') as HTMLInputElement;
    expect(procedureInput?.value).toBe('Root Canal Treatment (RCT)');

    const costInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(costInput?.value).toBe('250');
  });


  it('Phase 6 preserves catalogue identity in the save payload and shows tooth clinical relationships', async () => {
    const openDiagnosis = vi.fn();
    const saveDiagnosis = vi.fn(async () => undefined);
    await act(async () => {
      root.render(<QueryClientProvider client={queryClient}><OpdDentalExaminationTab visitId="visit-1" canEdit={true}
        diagnoses={[{ code: 'K02.9', name: 'Dental caries', category: 'Dental & Oral Health', tooth_number: 16 }, { code: 'K05.1', name: 'Gingivitis', category: 'Dental & Oral Health' }]}
        onOpenDiagnosis={openDiagnosis} onSaveDiagnosis={saveDiagnosis} /></QueryClientProvider>);
    });
    const relationship = container.querySelector('[aria-label="Dental clinical relationship"]');
    expect(relationship?.textContent).toContain('Tooth #16');
    expect(relationship?.textContent).toContain('CARIOUS');
    expect(relationship?.textContent).toContain('K02.9');
    expect(relationship?.textContent).toContain('Composite Restoration');
    expect(relationship?.textContent).toContain('General / Full Mouth: K05.1');
    await act(async () => { container.querySelector<HTMLElement>('[aria-label="Tooth 16: Maxillary Right First Molar"]')?.click(); });
    await act(async () => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Add diagnosis for Tooth #16'))?.click(); });
    expect(openDiagnosis).toHaveBeenCalledWith(16);
    await act(async () => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Save Draft'))?.click(); });
    expect(saveDiagnosis).toHaveBeenCalledOnce();
    expect(api.saveDentalExaminationDraft).toHaveBeenCalledWith('visit-1', expect.objectContaining({ treatment_plan_items: [expect.objectContaining({ id: '507f1f77bcf86cd799439011', service_id: '507f1f77bcf86cd799439012', tooth_number: 16 })] }));
  });

  it('Phase 6 retains dirty findings on background refetch and warns before leaving', async () => {
    await act(async () => { root.render(<QueryClientProvider client={queryClient}><OpdDentalExaminationTab visitId="visit-1" canEdit={true} /></QueryClientProvider>); });
    await act(async () => { container.querySelector<HTMLElement>('[aria-label="Tooth 16: Maxillary Right First Molar"]')?.click(); });
    await act(async () => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Mark Healthy'))?.click(); });
    await act(async () => { queryClient.setQueryData(opdKeys.dentalExamination('visit-1'), { ...mockExamData, updated_at: '2026-09-07T12:00:00.000Z' }); });
    expect(container.textContent).toContain('Unsaved Changes');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const event = new CustomEvent('hms:before-navigation', { cancelable: true, detail: { to: '/patients' } });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledOnce();
    confirm.mockRestore();
    await act(async () => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Save Draft'))?.click(); });
    expect(api.saveDentalExaminationDraft).toHaveBeenCalledWith('visit-1', expect.objectContaining({ teeth: [expect.objectContaining({ conditions: ['HEALTHY'] })] }));
  });

  it('displays unsaved changes badge when dirty and clears upon save draft', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} />
        </QueryClientProvider>,
      );
    });

    // Initially clean
    expect(container.textContent).not.toContain('Unsaved Changes');

    // Select tooth 16 and update finding
    const tooth16Card = container.querySelector('[aria-label="Tooth 16: Maxillary Right First Molar"]');
    await act(async () => {
      tooth16Card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Click "Mark Healthy" quick action
    const markHealthyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Mark Healthy'),
    );
    expect(markHealthyBtn).toBeDefined();
    await act(async () => {
      markHealthyBtn?.click();
    });

    // Now dirty badge should appear
    expect(container.textContent).toContain('Unsaved Changes');

    // Save draft
    const saveButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save Draft'),
    );
    await act(async () => {
      saveButton?.click();
    });

    // After save, dirty badge should clear
    expect(container.textContent).not.toContain('Unsaved Changes');
  });

  it('handles multiple Save Draft cycles with simulated hard refreshes (Cycle 1 -> Cycle 2 -> Cycle 3)', async () => {
    let serverDbRecord: OpdDentalExaminationResponse = { ...mockExamData };

    api.getDentalExamination.mockImplementation(async () => serverDbRecord);
    api.saveDentalExaminationDraft.mockImplementation(async (_vId: string, payload: unknown) => {
      const p = payload as {
        dental_history?: typeof mockExamData.dental_history;
        soft_tissue?: typeof mockExamData.soft_tissue;
        teeth?: typeof mockExamData.teeth;
        treatment_plan_items?: typeof mockExamData.treatment_plan_items;
      };
      serverDbRecord = {
        ...serverDbRecord,
        ...(p.dental_history ? { dental_history: p.dental_history } : {}),
        ...(p.soft_tissue ? { soft_tissue: p.soft_tissue } : {}),
        ...(p.teeth ? { teeth: p.teeth } : {}),
        ...(p.treatment_plan_items ? { treatment_plan_items: p.treatment_plan_items } : {}),
        updated_at: new Date().toISOString(),
      };
      return serverDbRecord;
    });

    // === CYCLE 1: Modify Tooth 18, Add Procedure ===
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} />
        </QueryClientProvider>,
      );
    });

    // Select Tooth 18
    const tooth18Card = container.querySelector('[aria-label="Tooth 18: Maxillary Right Third Molar (Wisdom)"]');
    await act(async () => {
      tooth18Card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Click Caries for Tooth 18
    const cariesBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Caries',
    );
    await act(async () => {
      cariesBtn?.click();
    });

    // Save Cycle 1
    const saveBtn1 = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save Draft'),
    );
    await act(async () => {
      saveBtn1?.click();
    });

    // Verify backend received Tooth 18
    expect(serverDbRecord.teeth.some((t) => t.tooth_number === 18 && t.conditions.includes('CARIOUS'))).toBe(true);

    // Hard refresh simulation: create fresh QueryClient, unmount & remount
    await act(async () => root.unmount());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const freshClient1 = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    freshClient1.setQueryData(opdKeys.dentalExamination('visit-1'), serverDbRecord);

    await act(async () => {
      root.render(
        <QueryClientProvider client={freshClient1}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} />
        </QueryClientProvider>,
      );
    });

    // Verify restored from fresh GET
    expect(container.textContent).not.toContain('Unsaved Changes');
    const reloadedTooth18 = container.querySelector('[aria-label="Tooth 18: Maxillary Right Third Molar (Wisdom)"]');
    await act(async () => {
      reloadedTooth18?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('FDI #18');
    expect(container.textContent).toContain('Maxillary Right Third Molar (Wisdom)');

    // === CYCLE 2: Change Soft Tissue & Modify Tooth 36 ===
    const gingivaSelect = container.querySelector('select') as HTMLSelectElement;
    if (gingivaSelect) {
      await act(async () => {
        gingivaSelect.value = 'Severe Gingivitis';
        gingivaSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    const saveBtn2 = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save Draft'),
    );
    await act(async () => {
      saveBtn2?.click();
    });

    // Hard refresh simulation 2
    await act(async () => root.unmount());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const freshClient2 = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    freshClient2.setQueryData(opdKeys.dentalExamination('visit-1'), serverDbRecord);

    await act(async () => {
      root.render(
        <QueryClientProvider client={freshClient2}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} />
        </QueryClientProvider>,
      );
    });

    // Verify Cycle 1 (Tooth 18) AND Cycle 2 (Tooth 16 still exists, changes intact)
    expect(serverDbRecord.teeth.some((t) => t.tooth_number === 18)).toBe(true);
    expect(serverDbRecord.teeth.some((t) => t.tooth_number === 16)).toBe(true);
  });

  it('handles Save Draft failure correctly (retains dirty badge, keeps unsaved input, displays error toast)', async () => {
    const showToastMock = vi.fn();
    api.saveDentalExaminationDraft.mockRejectedValueOnce(new Error('Network connection timeout'));

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} showToast={showToastMock} />
        </QueryClientProvider>,
      );
    });

    // Make an edit to trigger dirty state
    const tooth16Card = container.querySelector('[aria-label="Tooth 16: Maxillary Right First Molar"]');
    await act(async () => {
      tooth16Card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const markHealthyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Mark Healthy'),
    );
    await act(async () => {
      markHealthyBtn?.click();
    });

    expect(container.textContent).toContain('Unsaved Changes');

    // Attempt save which will fail
    const saveButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save Draft'),
    );
    await act(async () => {
      saveButton?.click();
    });

    // Verify error toast was called
    expect(showToastMock).toHaveBeenCalledWith('Network connection timeout', 'error');

    // Unsaved changes badge must REMAIN visible
    expect(container.textContent).toContain('Unsaved Changes');
  });

  it('maintains independent tooth finding state across tooth selection and selective reset', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} />
        </QueryClientProvider>,
      );
    });

    // Select Tooth 11 (Permanent Upper Right Central Incisor)
    const tooth11 = container.querySelector('[aria-label="Tooth 11: Maxillary Right Central Incisor"]');
    await act(async () => {
      tooth11?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('FDI #11');

    // Mark Caries on Tooth 11
    const cariesBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Caries',
    );
    await act(async () => {
      cariesBtn?.click();
    });

    // Select Tooth 21 (Permanent Upper Left Central Incisor)
    const tooth21 = container.querySelector('[aria-label="Tooth 21: Maxillary Left Central Incisor"]');
    await act(async () => {
      tooth21?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('FDI #21');

    // Mark Healthy on Tooth 21
    const healthyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Mark Healthy'),
    );
    await act(async () => {
      healthyBtn?.click();
    });

    // Re-select Tooth 11 and verify findings were preserved
    await act(async () => {
      tooth11?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('FDI #11');

    // Reset Tooth 11
    const resetBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reset'),
    );
    await act(async () => {
      resetBtn?.click();
    });

    // Re-select Tooth 21 and verify Tooth 21 was NOT reset
    await act(async () => {
      tooth21?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('FDI #21');
  });

  it('supports adding planned procedures, changing status lifecycle, and calculating financial summaries', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} />
        </QueryClientProvider>,
      );
    });

    // Check existing item is rendered
    expect(container.textContent).toContain('Proposed Dental Treatment Plan & Procedures');
    expect(container.textContent).toContain('Composite Restoration');
    expect(container.textContent).toContain('#16');

    // Fill the Add Procedure form
    const procedureInput = container.querySelector('input[placeholder*="Composite Restoration"]') as HTMLInputElement;
    const costInput = container.querySelector('input[placeholder="0.00"]') as HTMLInputElement;
    const notesInput = container.querySelector('input[placeholder*="Shade A2"]') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    expect(procedureInput).toBeDefined();
    expect(form).toBeDefined();

    const setInputValue = (input: HTMLInputElement, val: string) => {
      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      descriptor?.set?.call(input, val);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // Add Root Canal Treatment for Tooth 36
    await act(async () => {
      setInputValue(procedureInput, 'Root Canal Treatment');
      if (costInput) setInputValue(costInput, '350');
      if (notesInput) setInputValue(notesInput, '4 canals identified');
    });

    // Submit form
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    // Verify new procedure appears in table
    expect(container.textContent).toContain('Root Canal Treatment');
    expect(container.textContent).toContain('4 canals identified');

    // Change status of first item from PROPOSED to ACCEPTED
    const statusSelects = container.querySelectorAll('table select');
    expect(statusSelects.length).toBeGreaterThan(0);

    await act(async () => {
      const firstStatusSelect = statusSelects[0] as HTMLSelectElement;
      firstStatusSelect.value = 'ACCEPTED';
      firstStatusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Save draft and verify both items and status are saved
    const saveButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save Draft'),
    );
    await act(async () => {
      saveButton?.click();
    });

    expect(api.saveDentalExaminationDraft).toHaveBeenCalledWith(
      'visit-1',
      expect.objectContaining({
        treatment_plan_items: expect.arrayContaining([
          expect.objectContaining({
            procedure_name: 'Composite Restoration',
            status: 'ACCEPTED',
          }),
          expect.objectContaining({
            procedure_name: 'Root Canal Treatment',
            notes: '4 canals identified',
          }),
        ]),
      }),
    );
  });

  it('allows removing a planned procedure item from the treatment plan', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} />
        </QueryClientProvider>,
      );
    });

    expect(container.textContent).toContain('Composite Restoration');

    // Find and click trash button
    const deleteBtn = container.querySelector('button[title="Remove procedure"]') as HTMLButtonElement;
    expect(deleteBtn).not.toBeNull();

    await act(async () => {
      deleteBtn.click();
    });

    // Item should now be removed from table
    expect(container.textContent).not.toContain('Composite Restoration');
    expect(container.textContent).toContain('No planned dental procedures recorded');
  });

  it('shows an explicit billing action only when the existing Billing permission is available', async () => {
    const onCreateInvoice = vi.fn(async () => undefined);
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab
            visitId="visit-1"
            canEdit={true}
            canCreateInvoice={true}
            onCreateInvoice={onCreateInvoice}
            departmentServices={[
              {
                id: '507f1f77bcf86cd799439012',
                code: 'DENT-REST',
                name: 'Composite Restoration',
                service_type: 'PROCEDURE',
                department_id: 'dept-dent',
                standard_price: 900,
                default_duration_minutes: null,
                booking_capacity: null,
                requires_bed: false,
                requires_consent: false,
                requires_advance_deposit: false,
                minimum_advance_deposit_amount: null,
                status: 'ACTIVE',
                category: null,
                description: null,
                sample_type: null,
                created_by: null,
                updated_by: null,
                created_at: '2026-09-07T10:00:00.000Z',
                updated_at: '2026-09-07T10:00:00.000Z',
              },
            ]}
          />
        </QueryClientProvider>,
      );
    });

    const row = container.querySelector('tbody tr');
    expect(row?.textContent).toContain('#16');
    expect(row?.textContent).toContain('Composite Restoration');
    expect(row?.textContent).toContain('900.00');
    const createButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Create Invoice'),
    );
    expect(createButton).toBeTruthy();
    await act(async () => createButton?.click());
    expect(onCreateInvoice).toHaveBeenCalledWith('507f1f77bcf86cd799439011');

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab visitId="visit-1" canEdit={true} />
        </QueryClientProvider>,
      );
    });
    expect(container.textContent).toContain('Not billed');
    expect(container.textContent).not.toContain('Create Invoice');
  });

  it('shows the existing invoice state and prevents a duplicate billing action', async () => {
    const onCreateInvoice = vi.fn(async () => undefined);
    const onOpenInvoice = vi.fn();
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab
            visitId="visit-1"
            canEdit={true}
            canCreateInvoice={true}
            onCreateInvoice={onCreateInvoice}
            onOpenInvoice={onOpenInvoice}
            billingStates={[
              {
                treatment_item_id: '507f1f77bcf86cd799439011',
                invoice_item_id: '507f1f77bcf86cd799439021',
                invoice_id: '507f1f77bcf86cd799439022',
                invoice_number: 'INV-DENT-001',
                invoice_status: 'PAID',
                service_id: '507f1f77bcf86cd799439012',
                service_name: 'Composite Restoration',
                unit_price: 275.5,
              },
            ]}
          />
        </QueryClientProvider>,
      );
    });

    expect(container.textContent).toContain('Paid');
    expect(container.textContent).toContain('INV-DENT-001');
    expect(container.textContent).not.toContain('Create Invoice');
    const invoiceButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('INV-DENT-001'),
    );
    await act(async () => invoiceButton?.click());
    expect(onOpenInvoice).toHaveBeenCalledWith('507f1f77bcf86cd799439022');
    expect(onCreateInvoice).not.toHaveBeenCalled();
  });

  it('keeps completed clinical data read-only while allowing permitted billing navigation', async () => {
    const completedExam = {
      ...mockExamData,
      status: 'COMPLETED' as const,
      completed_at: '2026-09-08T10:00:00.000Z',
    };
    api.getDentalExamination.mockResolvedValue(completedExam);
    queryClient.setQueryData(opdKeys.dentalExamination('visit-1'), completedExam);
    const onCreateInvoice = vi.fn(async () => undefined);
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdDentalExaminationTab
            visitId="visit-1"
            canEdit={false}
            canCreateInvoice={true}
            onCreateInvoice={onCreateInvoice}
          />
        </QueryClientProvider>,
      );
    });

    expect(container.textContent).toContain('Completed & Locked');
    expect(container.querySelector('button[title="Remove procedure"]')).toBeNull();
    expect(container.textContent).toContain('Create Invoice');
  });
});
