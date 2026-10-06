// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OpdPrescriptionSection,
  type MedicationFormState,
  type PrescriptionFormState,
  type OpdPrescriptionSectionProps,
} from './OpdPrescriptionSection';
import type { OpdVisitResponse } from '../../api/opd';
import type { PatientResponse } from '../../api/patients';

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ user: { branches: [{ id: 'branch-1', name: 'Main Branch' }] } }),
}));
vi.mock('../../context/BranchContext', () => ({
  useActiveBranch: () => ({ activeBranchId: 'branch-1' }),
}));
vi.mock('../../hooks/settings/useSettings', () => ({
  useHospitalSettings: () => ({ hospitalName: 'HMS Enterprise Hospital' }),
}));

describe('OpdPrescriptionSection Component', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const emptyMedForm: MedicationFormState = {
    medicine_name: '',
    strength: '',
    dosage: '',
    route: 'Oral',
    frequency: 'BD',
    duration: '5 Days',
    quantity: '1',
    instructions: '',
  };

  const emptyRxForm: PrescriptionFormState = {
    items: [],
    follow_up_date: '',
    doctor_instructions: '',
    patient_instructions: '',
  };

  const mockVisit: OpdVisitResponse = {
    id: 'visit-12345678',
    visit_number: 'OPD-2026-001',
    queue_token_number: 1,
    appointment_id: null,
    patient_id: 'patient-1',
    patient_number: 'PAT-2026-001',
    patient_name: 'John Doe',
    doctor_id: 'doc-1',
    doctor_name: 'Dr. Jane Smith',
    doctor_specialization: 'General Medicine',
    branch_id: 'branch-1',
    department_id: 'dept-1',
    visit_date: '2026-10-06',
    check_in_time: '09:00',
    visit_type: 'NEW_CONSULTATION',
    priority: 'ROUTINE',
    status: 'IN_CONSULTATION',
    reason: null,
    notes: null,
    created_by: null,
    updated_by: null,
    created_at: '2026-10-06T09:00:00.000Z',
    updated_at: '2026-10-06T09:00:00.000Z',
  };

  const mockPatient: PatientResponse = {
    id: 'patient-1',
    patient_number: 'PAT-2026-001',
    first_name: 'John',
    middle_name: null,
    last_name: 'Doe',
    gender: 'MALE',
    date_of_birth: '1990-01-01',
    parent_guardian: null,
    phone: '0712345678',
    email: 'john@example.com',
    status: 'ACTIVE',
    address: {},
    emergency_contact: {},
    registration_branch_id: 'branch-1',
    blood_group: 'O+',
    notes: null,
    created_by: null,
    updated_by: null,
    created_at: '2026-10-06T09:00:00.000Z',
    updated_at: '2026-10-06T09:00:00.000Z',
  };

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    root = null;
  });

  const renderComponent = (props: Partial<OpdPrescriptionSectionProps> = {}) => {
    const defaultProps: OpdPrescriptionSectionProps = {
      selectedDiagnoses: [],
      setActiveTab: vi.fn(),
      masterMedicines: [
        { id: 'med-1', name: 'Amoxicillin', strength: '500mg', available_quantity: 50, unit: 'capsules' },
        { id: 'med-2', name: 'Paracetamol', strength: '500mg', available_quantity: 100, unit: 'tablets' },
      ],
      medicationForm: emptyMedForm,
      setMedicationForm: vi.fn(),
      prescriptionForm: emptyRxForm,
      setPrescriptionForm: vi.fn(),
      emptyMedicationForm: emptyMedForm,
      showToast: vi.fn(),
      saveConsultationDraft: vi.fn(),
      handleSendToPharmacy: vi.fn().mockResolvedValue(undefined),
      updating: '',
      handleNextStep: vi.fn(),
      canEdit: true,
      isDental: false,
      visit: mockVisit,
      patient: mockPatient,
      isSentToPharmacy: false,
      ...props,
    };

    act(() => {
      root!.render(<OpdPrescriptionSection {...defaultProps} />);
    });

    return defaultProps;
  };

  it('renders initial state with enabled [ Send To Pharmacy ] button', () => {
    renderComponent({ isSentToPharmacy: false, updating: '' });

    const buttons = Array.from(container!.querySelectorAll('button'));
    const sendBtn = buttons.find((b) => b.textContent?.includes('Send To Pharmacy'));
    expect(sendBtn).toBeDefined();
    expect(sendBtn?.disabled).toBe(false);
  });

  it('renders disabled [ Sending... ] with spinner when updating is prescription-submit', () => {
    renderComponent({ isSentToPharmacy: false, updating: 'prescription-submit' });

    const buttons = Array.from(container!.querySelectorAll('button'));
    const sendingBtn = buttons.find((b) => b.textContent?.includes('Sending...'));
    expect(sendingBtn).toBeDefined();
    expect(sendingBtn?.disabled).toBe(true);
  });

  it('renders disabled [ Sent To Pharmacy ] with checkmark and sent-disabled styling when isSentToPharmacy is true', () => {
    const handleSend = vi.fn().mockResolvedValue(undefined);
    renderComponent({ isSentToPharmacy: true, updating: '', handleSendToPharmacy: handleSend });

    const buttons = Array.from(container!.querySelectorAll('button'));
    const sentBtn = buttons.find((b) => b.textContent?.includes('Sent To Pharmacy'));
    expect(sentBtn).toBeDefined();
    expect(sentBtn?.disabled).toBe(true);
    expect(sentBtn?.classList.contains('sent-disabled')).toBe(true);
    expect(sentBtn?.classList.contains('primary')).toBe(false);

    // Clicking when sent does not call handleSendToPharmacy
    act(() => {
      sentBtn?.click();
    });
    expect(handleSend).not.toHaveBeenCalled();
  });

  it('prevents rapid double-click submissions when updating', () => {
    const handleSend = vi.fn().mockResolvedValue(undefined);
    renderComponent({ isSentToPharmacy: false, updating: 'prescription-submit', handleSendToPharmacy: handleSend });

    const buttons = Array.from(container!.querySelectorAll('button'));
    const btn = buttons.find((b) => b.textContent?.includes('Sending...'));
    expect(btn?.disabled).toBe(true);

    act(() => {
      btn?.click();
    });
    expect(handleSend).not.toHaveBeenCalled();
  });

  it('shows error toast when Print Prescription is clicked with no medications prescribed', () => {
    const showToast = vi.fn();
    renderComponent({
      prescriptionForm: { ...emptyRxForm, items: [] },
      prescription: null,
      showToast,
    });

    const buttons = Array.from(container!.querySelectorAll('button'));
    const printBtn = buttons.find((b) => b.textContent?.includes('Print Prescription'));
    expect(printBtn).toBeDefined();

    act(() => {
      printBtn?.click();
    });

    expect(showToast).toHaveBeenCalledWith('Add at least one medication before printing prescription.', 'error');
  });

  it('triggers browser print directly without opening a modal when Print Prescription is clicked with prescribed items', () => {
    const showToast = vi.fn();
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const rxWithItems: PrescriptionFormState = {
      items: [
        {
          local_id: 'item-1',
          medicine_name: 'Amoxicillin',
          strength: '500mg',
          dosage: '1 capsule',
          route: 'Oral',
          frequency: 'TDS',
          duration: '5 Days',
          quantity: '15',
          instructions: 'After meals',
        },
      ],
      follow_up_date: '',
      doctor_instructions: 'Take full course of antibiotics',
      patient_instructions: 'Drink plenty of water',
    };

    renderComponent({
      prescriptionForm: rxWithItems,
      showToast,
    });

    const buttons = Array.from(container!.querySelectorAll('button'));
    const printBtn = buttons.find((b) => b.textContent?.includes('Print Prescription'));
    expect(printBtn).toBeDefined();

    act(() => {
      printBtn?.click();
    });

    expect(showToast).not.toHaveBeenCalled();
    // Directly calls browser print
    expect(printSpy).toHaveBeenCalled();
    // No modal should be opened
    expect(document.querySelector('.modal-overlay')).toBeNull();
    // Printable document content is rendered in DOM for print
    expect(document.body.textContent).toContain('Official Prescription');
    expect(document.body.textContent).toContain('Amoxicillin');
    expect(document.body.textContent).toContain('John Doe');
    expect(document.body.textContent).toContain('PAT-2026-001');
    expect(document.body.textContent).toContain('Take full course of antibiotics');

    printSpy.mockRestore();
  });

  it('navigates to next step Imaging Orders via Next: Imaging button', () => {
    const handleNextStep = vi.fn();
    renderComponent({ handleNextStep });

    const buttons = Array.from(container!.querySelectorAll('button'));
    const nextBtn = buttons.find((b) => b.textContent?.includes('Next: Imaging'));
    expect(nextBtn).toBeDefined();

    act(() => {
      nextBtn?.click();
    });

    expect(handleNextStep).toHaveBeenCalledWith('Imaging');
  });
});
