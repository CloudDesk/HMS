// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpdClinicalOrderResponse, OpdVisitResponse } from '../api/opd';
import type { PatientResponse } from '../api/patients';
import type { DepartmentResponse } from '../api/departments';
import type { ServiceResponse } from '../api/services';

const testState = vi.hoisted(() => ({
  loading: true,
  loadError: '',
  activeVisitId: '',
  activeTab: 'Consultation',
  visit: null as OpdVisitResponse | null,
  patient: null as PatientResponse | null,
  departments: [] as DepartmentResponse[],
  services: [] as ServiceResponse[],
  canViewConsultation: true,
  canEditConsultation: true,
  laboratoryOrder: null as OpdClinicalOrderResponse | null,
  imagingOrder: null as OpdClinicalOrderResponse | null,
}));

vi.mock('../hooks/opd/useOpdVisitFeature', () => ({
  useOpdVisitFeature: () => ({
    state: {
      activeVisitId: testState.activeVisitId,
      activeTab: testState.activeTab,
      recentVisits: [],
      visit: testState.visit,
      patient: testState.patient,
      vitals: null,
      consultation: null,
      prescription: null,
      followUp: null,
      referral: null,
      laboratoryOrder: testState.laboratoryOrder,
      imagingOrder: testState.imagingOrder,
      doctors: [],
      masterMedicines: [],
      services: testState.services,
      branches: [{ id: 'branch-1', name: 'Main Branch' }],
      departments: testState.departments,
      documents: [],
      loading: testState.loading,
      loadError: testState.loadError,
      updating: false,
      canViewConsultation: testState.canViewConsultation,
      canEditConsultation: testState.canEditConsultation,
      canEditPrescription: true,
      canEditClinicalOrders: true,
      canEditReferral: true,
      canEditFollowUp: true,
      canCreateVitals: true,
      billingCapabilities: { canView: true, canCreate: true },
      dentalBillingStates: [],
      dentalBillingLoading: false,
      dentalBillingError: '',
      billingTreatmentItemPending: null,
    },
    actions: {
      setActiveTab: vi.fn((tab: string) => {
        testState.activeTab = tab;
      }),
      selectVisit: vi.fn(),
      refetchVisit: vi.fn(),
      createVitals: vi.fn(),
      submitReferral: vi.fn(),
      scheduleFollowUp: vi.fn(),
      saveWorkspaceDraft: vi.fn(),
      saveDentalDiagnosis: vi.fn(),
      submitPrescription: vi.fn(),
      submitClinicalOrder: vi.fn(),
      completeWorkspace: vi.fn(),
      uploadDocument: vi.fn(),
      downloadDocument: vi.fn(),
      deleteDocument: vi.fn(),
      callNextPatient: vi.fn(),
      createDentalTreatmentInvoice: vi.fn(),
    },
  }),
}));

vi.mock('../routing/navigation', () => ({
  navigate: vi.fn(),
  useAppLocation: () => ({ pathname: '/opd/consultation', search: '' }),
}));
vi.mock('../context/BranchContext', () => ({ useActiveBranch: () => ({ activeBranchId: 'branch-1' }) }));
vi.mock('../api/useSettings', () => ({ useTimezone: () => 'UTC' }));
vi.mock('../components/opd/dental/OpdDentalExaminationTab', () => ({
  OpdDentalExaminationTab: (props: { visitId?: string; [key: string]: unknown }) => (
    <div data-testid="opd-dental-examination-tab">
      <span>Dental Examination Component</span>
      <span>Visit: {props.visitId}</span>
    </div>
  ),
}));
vi.mock('../components/opd/OpdPatientTimelineModal', () => ({
  OpdPatientTimelineModal: (props: {
    open: boolean;
    onClose: () => void;
    patientId: string;
    patientName: string;
    patientNumber: string;
  }) => (
    props.open ? (
      <div data-testid="opd-patient-timeline-modal">
        <span>Patient Timeline & Encounter History</span>
        <span>{props.patientName}</span>
        <span>{props.patientNumber}</span>
        <button data-testid="timeline-modal-close" onClick={props.onClose} type="button">Close</button>
      </div>
    ) : null
  ),
}));

import { OpdVisitPage } from './OpdVisitPage';

describe('OpdVisitPage feature-hook rendering', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    testState.loading = true;
    testState.loadError = '';
    testState.activeVisitId = '';
    testState.activeTab = 'Consultation';
    testState.visit = null;
    testState.patient = null;
    testState.departments = [];
    testState.services = [];
    testState.canViewConsultation = true;
    testState.canEditConsultation = true;
    testState.laboratoryOrder = null;
    testState.imagingOrder = null;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders the loading state supplied by the feature hook', async () => {
    await act(async () => root.render(<OpdVisitPage />));

    expect(container.textContent).toContain('Loading consultation workspace');
  });

  it('renders the feature-hook error and empty states', async () => {
    testState.loading = false;
    testState.loadError = 'Unable to load OPD visit.';

    await act(async () => root.render(<OpdVisitPage />));

    expect(container.textContent).toContain('Unable to load OPD visit.');
    expect(container.textContent).toContain('No Active Visit Selected');
  });

  it('renders the "Dental Examination" tab when the active visit belongs to the Dental department', async () => {
    testState.loading = false;
    testState.activeVisitId = 'visit-dental-1';
    testState.visit = {
      id: 'visit-dental-1',
      visit_number: 'OPD-DENT-001',
      patient_id: 'pat-1',
      patient_name: 'Jane Doe',
      patient_number: 'MRN-001',
      doctor_id: 'doc-dent-1',
      doctor_specialization: 'Dentistry',
      branch_id: 'branch-1',
      department_id: 'dept-dent-1',
      status: 'IN_CONSULTATION',
      visit_type: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
    } as unknown as OpdVisitResponse;
    testState.patient = {
      id: 'pat-1',
      mrn: 'MRN-001',
      first_name: 'Jane',
      last_name: 'Doe',
      gender: 'FEMALE',
      date_of_birth: '1990-01-01',
      phone_number: '1234567890',
    } as unknown as PatientResponse;
    testState.departments = [
      { id: 'dept-dent-1', name: 'Dental Department', code: 'DENT', branch_ids: ['branch-1'] },
      { id: 'dept-cardio-1', name: 'Cardiology', code: 'CARD', branch_ids: ['branch-1'] },
    ] as unknown as DepartmentResponse[];

    await act(async () => root.render(<OpdVisitPage />));

    expect(container.textContent).toContain('1 Consultation');
    expect(container.textContent).toContain('2 Dental Examination');
    expect(container.textContent).toContain('3 Prescription');
    expect(container.textContent).toContain('4 Referral');
    expect(container.textContent).not.toContain('3 Diagnosis');
    expect(container.textContent).not.toContain('4 Lab Orders');
    expect(container.textContent).not.toContain('5 Imaging Orders');
    expect(container.textContent).not.toContain('6 Follow-up');
    expect(container.textContent).not.toContain('7 Follow-up');
  });

  it('does NOT render the "Dental Examination" tab for non-Dental visits (protecting OPD regression)', async () => {
    testState.loading = false;
    testState.activeVisitId = 'visit-cardio-1';
    testState.visit = {
      id: 'visit-cardio-1',
      visit_number: 'OPD-CARD-001',
      patient_id: 'pat-2',
      patient_name: 'John Smith',
      patient_number: 'MRN-002',
      doctor_id: 'doc-card-1',
      doctor_specialization: 'Cardiology',
      branch_id: 'branch-1',
      department_id: 'dept-cardio-1',
      status: 'IN_CONSULTATION',
      visit_type: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
    } as unknown as OpdVisitResponse;
    testState.patient = {
      id: 'pat-2',
      mrn: 'MRN-002',
      first_name: 'John',
      last_name: 'Smith',
      gender: 'MALE',
      date_of_birth: '1985-05-15',
      phone_number: '9876543210',
    } as unknown as PatientResponse;
    testState.departments = [
      { id: 'dept-dent-1', name: 'Dental Department', code: 'DENT', branch_ids: ['branch-1'] },
      { id: 'dept-cardio-1', name: 'Cardiology', code: 'CARD', branch_ids: ['branch-1'] },
    ] as unknown as DepartmentResponse[];

    await act(async () => root.render(<OpdVisitPage />));

    expect(container.textContent).not.toContain('Dental Examination');
    expect(container.textContent).toContain('1 Consultation');
    expect(container.textContent).toContain('2 Diagnosis');
    expect(container.textContent).toContain('5 Imaging Orders');
    expect(container.textContent).toContain('6 Referral');
  });

  it('renders the OpdDentalExaminationTab when activeTab is "Dental Examination"', async () => {
    testState.loading = false;
    testState.activeVisitId = 'visit-dental-1';
    testState.activeTab = 'Dental Examination';
    testState.visit = {
      id: 'visit-dental-1',
      visit_number: 'OPD-DENT-001',
      patient_id: 'pat-1',
      patient_name: 'Jane Doe',
      patient_number: 'MRN-001',
      doctor_id: 'doc-dent-1',
      doctor_specialization: 'Dentistry',
      branch_id: 'branch-1',
      department_id: 'dept-dent-1',
      status: 'IN_CONSULTATION',
      visit_type: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
    } as unknown as OpdVisitResponse;
    testState.patient = {
      id: 'pat-1',
      mrn: 'MRN-001',
      first_name: 'Jane',
      last_name: 'Doe',
      gender: 'FEMALE',
      date_of_birth: '1990-01-01',
      phone_number: '1234567890',
    } as unknown as PatientResponse;
    testState.departments = [
      { id: 'dept-dent-1', name: 'Dentistry', code: 'DENT', branch_ids: ['branch-1'] },
    ] as unknown as DepartmentResponse[];

    await act(async () => root.render(<OpdVisitPage />));

    const dentalExamElement = container.querySelector('[data-testid="opd-dental-examination-tab"]');
    expect(dentalExamElement).not.toBeNull();
    expect(dentalExamElement?.textContent).toContain('Dental Examination Component');
    expect(dentalExamElement?.textContent).toContain('Visit: visit-dental-1');

    expect(container.textContent).not.toContain('Patient Timeline');
  });

  it('preserves Imaging Orders for non-Dental visits and clears state when switching visits', async () => {
    testState.loading = false;
    testState.activeVisitId = 'visit-general-1';
    testState.activeTab = 'Imaging Orders';
    testState.visit = {
      id: 'visit-general-1',
      visit_number: 'OPD-GEN-001',
      patient_id: 'pat-1',
      patient_name: 'Jane Doe',
      patient_number: 'MRN-001',
      doctor_id: 'doc-general-1',
      doctor_name: 'General Doctor',
      doctor_specialization: 'General Medicine',
      branch_id: 'branch-1',
      department_id: 'dept-general-1',
      status: 'IN_CONSULTATION',
      visit_type: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
    } as unknown as OpdVisitResponse;
    testState.departments = [
      { id: 'dept-general-1', name: 'General Medicine', code: 'GEN', branch_ids: ['branch-1'] },
    ] as unknown as DepartmentResponse[];
    testState.imagingOrder = {
      priority: 'ROUTINE',
      clinical_notes: 'Tooth image',
      instructions: null,
      items: [{
        id: 'order-item-1',
        service_id: 'service-1',
        service_name: 'IOPA X-Ray',
        investigation_name: 'IOPA X-Ray',
        category: 'Dental Imaging',
        tooth_number: 36,
      }],
    } as unknown as OpdClinicalOrderResponse;

    await act(async () => root.render(<OpdVisitPage />));
    expect(container.textContent).toContain('IOPA X-Ray');

    testState.activeVisitId = 'visit-general-2';
    testState.visit = { ...testState.visit, id: 'visit-general-2', visit_number: 'OPD-GEN-002' } as OpdVisitResponse;
    testState.imagingOrder = null;
    await act(async () => root.render(<OpdVisitPage />));

    expect(container.textContent).not.toContain('IOPA X-Ray');
    expect(container.textContent).toContain('No tests selected.');
  });

  it('renders a compact clinician-first patient header with primary identity and secondary metadata, omitting redundant doctor name', async () => {
    testState.loading = false;
    testState.activeVisitId = 'visit-dental-1';
    testState.visit = {
      id: 'visit-dental-1',
      visit_number: 'OPD-DENT-001',
      patient_id: 'pat-1',
      patient_name: 'Jane Doe',
      patient_number: 'MRN-001',
      doctor_id: 'doc-dent-1',
      doctor_name: 'Dr. Anderson James',
      doctor_specialization: 'Dentistry',
      branch_id: 'branch-1',
      department_id: 'dept-dent-1',
      status: 'IN_CONSULTATION',
      visit_type: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
    } as unknown as OpdVisitResponse;
    testState.patient = {
      id: 'pat-1',
      mrn: 'MRN-001',
      first_name: 'Jane',
      last_name: 'Doe',
      gender: 'FEMALE',
      date_of_birth: '1990-01-01',
      phone_number: '1234567890',
    } as unknown as PatientResponse;
    testState.departments = [
      { id: 'dept-dent-1', name: 'Dentistry', code: 'DENT', branch_ids: ['branch-1'] },
    ] as unknown as DepartmentResponse[];

    await act(async () => root.render(<OpdVisitPage />));

    const banner = container.querySelector('.opd-patient-banner');
    expect(banner).not.toBeNull();
    expect(banner?.closest('.opd-page-header')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Refresh patient and visit data"]')).toBeNull();
    expect(container.querySelector('.opd-back-compact')?.getAttribute('aria-label')).toBe('Back to Queue');

    // Primary patient and visit identity
    const visitSelector = banner?.querySelector<HTMLSelectElement>('select[aria-label="Patient Visit"]');
    expect(visitSelector).not.toBeNull();
    expect(visitSelector?.selectedOptions[0]?.textContent).toContain(
      'Jane Doe (OPD-DENT-001) - In consultation',
    );
    expect(banner?.querySelector('.opd-mrn-chip')?.textContent).toBe('MRN-001');
    expect(banner?.querySelector('.opd-patient-avatar-box')?.textContent).toBe('JD');

    // Secondary encounter context
    expect(banner?.textContent).toContain('Female');
    expect(banner?.textContent).toContain('Dentistry');
    expect(banner?.textContent).toContain('New Consultation');
    expect(banner?.textContent).toContain('Patient Visit:');

    // Doctor name is removed from primary header
    expect(banner?.querySelector('.opd-patient-meta-line')?.textContent).not.toContain('Dr. Anderson James');

    // Tertiary action controls: exactly [Summary] and [Timeline] buttons
    const actionButtons = Array.from(banner?.querySelectorAll('.opd-patient-banner-actions button') ?? []);
    expect(actionButtons).toHaveLength(2);

    const summaryBtn = container.querySelector('button[aria-controls="opd-patient-summary-panel"]');
    expect(summaryBtn).not.toBeNull();
    expect(summaryBtn?.textContent).toContain('Summary');

    const timelineBtn = actionButtons.find((b) => b.textContent?.includes('Timeline'));
    expect(timelineBtn).toBeDefined();
    expect(timelineBtn?.getAttribute('title')).toBe('Patient Timeline & Encounter History');

    // More menu (⋮) and View Patient Profile are completely REMOVED
    expect(banner?.querySelector('.opd-hdr-more-btn')).toBeNull();
    expect(banner?.querySelector('.opd-more-menu-container')).toBeNull();
    expect(banner?.querySelector('.opd-more-menu-dropdown')).toBeNull();
    expect(banner?.textContent).not.toContain('View Patient Profile');

    // Clicking Timeline opens the Patient Timeline modal
    expect(container.querySelector('[data-testid="opd-patient-timeline-modal"]')).toBeNull();
    await act(async () => timelineBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const timelineModal = container.querySelector('[data-testid="opd-patient-timeline-modal"]');
    expect(timelineModal).not.toBeNull();
    expect(timelineModal?.textContent).toContain('Patient Timeline & Encounter History');
    expect(timelineModal?.textContent).toContain('Jane Doe');
  });
});
