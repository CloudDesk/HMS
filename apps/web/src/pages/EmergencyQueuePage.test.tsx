// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmergencyEncounter } from '../api/emergency';

const makeCaps = (overrides: Record<string, boolean>) => ({
  viewEncounters: false,
  register: false,
  linkPatient: false,
  viewTriage: false,
  assessTriage: false,
  overridePriority: false,
  viewConsultation: false,
  editConsultation: false,
  viewOrders: false,
  createOrders: false,
  viewDisposition: false,
  markNoShow: false,
  markLeft: false,
  cancel: false,
  discharge: false,
  transfer: false,
  admit: false,
  viewDocuments: false,
  createDocuments: false,
  viewReferral: false,
  ...overrides,
});

const DOCTOR_CAPS = makeCaps({
  viewEncounters: true,
  viewTriage: true,
  viewConsultation: true,
  editConsultation: true,
  viewOrders: true,
  createOrders: true,
  viewDisposition: true,
  markLeft: true,
  discharge: true,
  transfer: true,
  admit: true,
});

const RECEPTIONIST_CAPS = makeCaps({
  viewEncounters: true,
  register: true,
  linkPatient: true,
  markNoShow: true,
  cancel: true,
});

const NURSE_CAPS = makeCaps({
  viewEncounters: true,
  viewTriage: true,
  assessTriage: true,
  viewConsultation: true,
  viewOrders: true,
  viewDisposition: true,
});

const makeEncounters = (): EmergencyEncounter[] => [
  {
    id: 'enc-unassigned',
    encounter_number: 'ER-0001',
    emergency_identifier: 'ER-A001',
    branch_id: 'branch-1',
    department_id: 'dept-1',
    patient_id: null,
    patient_name: 'Unassigned Patient',
    patient_number: 'MRN-001',
    provisional_identity: null,
    arrival_mode: 'Walk-in',
    arrival_at: new Date().toISOString(),
    chief_complaint: 'Fever',
    arrival_notes: null,
    status: 'WAITING_FOR_DOCTOR',
    version: 1,
    triage: {
      level: 'LEVEL_3_MEDIUM',
      effective_level: 'LEVEL_3_MEDIUM',
      area: 'B',
      nurse_user_id: 'nurse-1',
      assessed_at: new Date().toISOString(),
      override_reason: null,
      notes: null,
    },
    assigned_doctor_id: null,
    assigned_doctor_name: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as EmergencyEncounter,
  {
    id: 'enc-mine',
    encounter_number: 'ER-0002',
    emergency_identifier: 'ER-A002',
    branch_id: 'branch-1',
    department_id: 'dept-1',
    patient_id: null,
    patient_name: 'My Assigned Patient',
    patient_number: 'MRN-002',
    provisional_identity: null,
    arrival_mode: 'Ambulance',
    arrival_at: new Date().toISOString(),
    chief_complaint: 'Chest pain',
    arrival_notes: null,
    status: 'IN_CONSULTATION',
    version: 1,
    triage: {
      level: 'LEVEL_1_CRITICAL',
      effective_level: 'LEVEL_1_CRITICAL',
      area: 'A',
      nurse_user_id: 'nurse-1',
      assessed_at: new Date().toISOString(),
      override_reason: null,
      notes: null,
    },
    assigned_doctor_id: 'doc-1',
    assigned_doctor_name: 'Dr. Test',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as EmergencyEncounter,
  {
    id: 'enc-other-doc',
    encounter_number: 'ER-0003',
    emergency_identifier: 'ER-A003',
    branch_id: 'branch-1',
    department_id: 'dept-1',
    patient_id: null,
    patient_name: 'Dr Other Patient',
    patient_number: 'MRN-003',
    provisional_identity: null,
    arrival_mode: 'Walk-in',
    arrival_at: new Date().toISOString(),
    chief_complaint: 'Fracture',
    arrival_notes: null,
    status: 'IN_CONSULTATION',
    version: 1,
    triage: {
      level: 'LEVEL_2_HIGH',
      effective_level: 'LEVEL_2_HIGH',
      area: 'A',
      nurse_user_id: 'nurse-1',
      assessed_at: new Date().toISOString(),
      override_reason: null,
      notes: null,
    },
    assigned_doctor_id: 'doc-2',
    assigned_doctor_name: 'Dr. Other',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as EmergencyEncounter,
];

const testState = vi.hoisted(() => ({
  caps: {
    viewEncounters: false,
    register: false,
    linkPatient: false,
    viewTriage: false,
    assessTriage: false,
    overridePriority: false,
    viewConsultation: false,
    editConsultation: false,
    viewOrders: false,
    createOrders: false,
    viewDisposition: false,
    markNoShow: false,
    markLeft: false,
    cancel: false,
    discharge: false,
    transfer: false,
    admit: false,
    viewDocuments: false,
    createDocuments: false,
    viewReferral: false,
  } as Record<string, boolean>,
  currentUserId: 'user-123',
  currentDoctorId: 'doc-1',
  dashboardProfile: 'doctor' as 'doctor' | 'nurse' | 'receptionist' | 'viewer',
  encounters: [] as EmergencyEncounter[],
}));

vi.mock('../hooks/emergency/useEmergencyWorkspaceFeature', () => ({
  useEmergencyWorkspaceFeature: () => ({
    state: {
      branchId: 'branch-1',
      branches: [{ id: 'branch-1', name: 'Main Branch' }],
      departmentId: '',
      triageLevel: '',
      search: '',
      departments: [{ id: 'dept-1', name: 'Emergency' }],
      doctors: [
        { id: 'doc-1', display_name: 'Dr. Test', user_id: 'user-123' },
        { id: 'doc-2', display_name: 'Dr. Other', user_id: 'user-456' },
      ],
      currentDoctor: { id: 'doc-1', display_name: 'Dr. Test', user_id: 'user-123' },
      currentDoctorId: testState.currentDoctorId,
      currentUserId: testState.currentUserId,
      encounters: testState.encounters,
      listQuery: { isLoading: false },
      capabilities: testState.caps,
      dashboardProfile: testState.dashboardProfile,
    },
    actions: {
      setBranchId: vi.fn(),
      setDepartmentId: vi.fn(),
      setTriageLevel: vi.fn(),
      setSearch: vi.fn(),
      setStatus: vi.fn(),
    },
    mutations: {
      call: { mutateAsync: vi.fn(), isPending: false },
      reasonAction: { mutateAsync: vi.fn(), isPending: false },
    },
  }),
}));

vi.mock('../routing/navigation', () => ({
  navigate: vi.fn(),
  useAppLocation: () => ({
    pathname: '/emergency/queue',
    search: '?branch_id=branch-1',
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import React from 'react';
import { EmergencyQueuePage } from './EmergencyQueuePage';

describe('EmergencyQueuePage – role-based queue visibility and doctor filtering', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    testState.encounters = makeEncounters();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  describe('Doctor queue isolation', () => {
    beforeEach(() => {
      testState.caps = DOCTOR_CAPS;
      testState.dashboardProfile = 'doctor';
      testState.currentDoctorId = 'doc-1';
      testState.currentUserId = 'user-123';
    });

    it('shows only own assigned cases and unassigned cases for a normal doctor', async () => {
      await act(async () => root.render(<EmergencyQueuePage />));
      expect(container.textContent).toContain('Unassigned Patient');
      expect(container.textContent).toContain('My Assigned Patient');
      expect(container.textContent).not.toContain('Dr Other Patient');
    });

    it('does NOT render a Doctor select dropdown for a normal doctor (shows locked Doctor Scope indicator)', async () => {
      await act(async () => root.render(<EmergencyQueuePage />));
      // No select element for doctor filter
      const doctorSelect = container.querySelector('select#er-doc-filter');
      expect(doctorSelect).toBeNull();
      // Shows read-only scope indicator
      expect(container.textContent).toContain('Doctor Scope');
      expect(container.textContent).toContain('My Assigned Cases + Unassigned');
    });
  });

  describe('Queue supervision oversight (Receptionist & Nurse)', () => {
    it('allows Receptionist to view all patients and select any doctor filter', async () => {
      testState.caps = RECEPTIONIST_CAPS;
      testState.dashboardProfile = 'receptionist';
      await act(async () => root.render(<EmergencyQueuePage />));

      // All patients visible in queue
      expect(container.textContent).toContain('Unassigned Patient');
      expect(container.textContent).toContain('My Assigned Patient');
      expect(container.textContent).toContain('Dr Other Patient');

      // Doctor select dropdown is present
      const doctorSelect = container.querySelector('select#er-doc-filter');
      expect(doctorSelect).not.toBeNull();
    });

    it('allows Nurse to view all patients and select any doctor filter for triage coordination', async () => {
      testState.caps = NURSE_CAPS;
      testState.dashboardProfile = 'nurse';
      await act(async () => root.render(<EmergencyQueuePage />));

      // All patients visible in queue
      expect(container.textContent).toContain('Unassigned Patient');
      expect(container.textContent).toContain('My Assigned Patient');
      expect(container.textContent).toContain('Dr Other Patient');

      // Doctor select dropdown is present
      const doctorSelect = container.querySelector('select#er-doc-filter');
      expect(doctorSelect).not.toBeNull();
    });
  });

  describe('Status-based row action visibility', () => {
    it('shows Call Patient and Open Workspace for active waiting queue patients, but only Open Workspace for non-callable / terminal states', async () => {
      testState.caps = DOCTOR_CAPS;
      testState.dashboardProfile = 'doctor';
      testState.currentDoctorId = 'doc-1';
      testState.currentUserId = 'user-123';

      testState.encounters = [
        {
          id: 'enc-waiting',
          encounter_number: 'ER-0001',
          emergency_identifier: 'ER-A001',
          branch_id: 'branch-1',
          department_id: 'dept-1',
          patient_id: null,
          patient_name: 'Waiting Patient',
          patient_number: 'MRN-001',
          provisional_identity: null,
          arrival_mode: 'Walk-in',
          arrival_at: new Date().toISOString(),
          chief_complaint: 'Fever',
          arrival_notes: null,
          status: 'WAITING_FOR_DOCTOR',
          version: 1,
          triage: {
            level: 'LEVEL_3_MEDIUM',
            effective_level: 'LEVEL_3_MEDIUM',
            area: 'B',
            nurse_user_id: 'nurse-1',
            assessed_at: new Date().toISOString(),
            override_reason: null,
            notes: null,
          },
          assigned_doctor_id: 'doc-1',
          assigned_doctor_name: 'Dr. Test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as unknown as EmergencyEncounter,
        {
          id: 'enc-consulting',
          encounter_number: 'ER-0002',
          emergency_identifier: 'ER-A002',
          branch_id: 'branch-1',
          department_id: 'dept-1',
          patient_id: null,
          patient_name: 'Consulting Patient',
          patient_number: 'MRN-002',
          provisional_identity: null,
          arrival_mode: 'Walk-in',
          arrival_at: new Date().toISOString(),
          chief_complaint: 'Pain',
          arrival_notes: null,
          status: 'IN_CONSULTATION',
          version: 1,
          triage: {
            level: 'LEVEL_2_HIGH',
            effective_level: 'LEVEL_2_HIGH',
            area: 'A',
            nurse_user_id: 'nurse-1',
            assessed_at: new Date().toISOString(),
            override_reason: null,
            notes: null,
          },
          assigned_doctor_id: 'doc-1',
          assigned_doctor_name: 'Dr. Test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as unknown as EmergencyEncounter,
        {
          id: 'enc-discharged',
          encounter_number: 'ER-0003',
          emergency_identifier: 'ER-A003',
          branch_id: 'branch-1',
          department_id: 'dept-1',
          patient_id: null,
          patient_name: 'Discharged Patient',
          patient_number: 'MRN-003',
          provisional_identity: null,
          arrival_mode: 'Walk-in',
          arrival_at: new Date().toISOString(),
          chief_complaint: 'Healed',
          arrival_notes: null,
          status: 'DISCHARGED',
          version: 1,
          triage: {
            level: 'LEVEL_4_LOW',
            effective_level: 'LEVEL_4_LOW',
            area: 'C',
            nurse_user_id: 'nurse-1',
            assessed_at: new Date().toISOString(),
            override_reason: null,
            notes: null,
          },
          assigned_doctor_id: 'doc-1',
          assigned_doctor_name: 'Dr. Test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as unknown as EmergencyEncounter,
        {
          id: 'enc-cancelled',
          encounter_number: 'ER-0004',
          emergency_identifier: 'ER-A004',
          branch_id: 'branch-1',
          department_id: 'dept-1',
          patient_id: null,
          patient_name: 'Cancelled Patient',
          patient_number: 'MRN-004',
          provisional_identity: null,
          arrival_mode: 'Walk-in',
          arrival_at: new Date().toISOString(),
          chief_complaint: 'Cancelled',
          arrival_notes: null,
          status: 'CANCELLED',
          version: 1,
          triage: {
            level: 'LEVEL_5_NON_URGENT',
            effective_level: 'LEVEL_5_NON_URGENT',
            area: 'C',
            nurse_user_id: 'nurse-1',
            assessed_at: new Date().toISOString(),
            override_reason: null,
            notes: null,
          },
          assigned_doctor_id: 'doc-1',
          assigned_doctor_name: 'Dr. Test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as unknown as EmergencyEncounter,
      ];

      await act(async () => root.render(<EmergencyQueuePage />));

      const rows = container.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(4);

      // Row 0: Waiting - should have both Call Patient and Open Workspace
      const row0Actions = rows[0]?.querySelectorAll('.cell-actions button');
      expect(row0Actions).toHaveLength(2);
      expect(row0Actions?.[0]?.getAttribute('title')).toBe('Call Patient');
      expect(row0Actions?.[1]?.getAttribute('title')).toBe('Open Workspace');

      // Row 1: In Consultation - should ONLY have Open Workspace
      const row1Actions = rows[1]?.querySelectorAll('.cell-actions button');
      expect(row1Actions).toHaveLength(1);
      expect(row1Actions?.[0]?.getAttribute('title')).toBe('Open Workspace');

      // Row 2: Discharged - should ONLY have Open Workspace
      const row2Actions = rows[2]?.querySelectorAll('.cell-actions button');
      expect(row2Actions).toHaveLength(1);
      expect(row2Actions?.[0]?.getAttribute('title')).toBe('Open Workspace');

      // Row 3: Cancelled - should ONLY have Open Workspace
      const row3Actions = rows[3]?.querySelectorAll('.cell-actions button');
      expect(row3Actions).toHaveLength(1);
      expect(row3Actions?.[0]?.getAttribute('title')).toBe('Open Workspace');
    });

    it('renders the exact patient name in cell-patient-name element for proper multi-line wrapping', async () => {
      const longName = 'P3-4 Transaction Verification Patient With Extended Name';
      testState.caps = DOCTOR_CAPS;
      testState.dashboardProfile = 'doctor';
      testState.currentDoctorId = 'doc-1';
      testState.currentUserId = 'user-123';

      testState.encounters = [
        {
          id: 'enc-long-name',
          encounter_number: 'ER-0001',
          emergency_identifier: 'ER-A001',
          branch_id: 'branch-1',
          department_id: 'dept-1',
          patient_id: null,
          patient_name: longName,
          patient_number: 'MRN-001',
          provisional_identity: {
            display_name: longName,
            estimated_age: null,
            gender: null,
            contact: null,
            identity_notes: null,
          },
          arrival_mode: 'Walk-in',
          arrival_at: new Date().toISOString(),
          chief_complaint: 'Fever',
          arrival_notes: null,
          status: 'WAITING_FOR_DOCTOR',
          version: 1,
          triage: {
            level: 'LEVEL_3_MEDIUM',
            effective_level: 'LEVEL_3_MEDIUM',
            area: 'B',
            nurse_user_id: 'nurse-1',
            assessed_at: new Date().toISOString(),
            override_reason: null,
            notes: null,
          },
          assigned_doctor_id: 'doc-1',
          assigned_doctor_name: 'Dr. Test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as unknown as EmergencyEncounter,
      ];

      await act(async () => root.render(<EmergencyQueuePage />));

      const nameElement = container.querySelector('.cell-patient-name');
      expect(nameElement).not.toBeNull();
      expect(nameElement?.textContent?.trim()).toBe(longName);
    });
  });
});
