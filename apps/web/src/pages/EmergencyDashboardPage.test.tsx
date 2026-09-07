// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

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

const RECEPTIONIST_CAPS = makeCaps({
  viewEncounters: true,
  register: true,
  linkPatient: true,
  markNoShow: true,
  cancel: true,
  viewDocuments: true,
  createDocuments: true,
});

const NURSE_CAPS = makeCaps({
  viewEncounters: true,
  viewTriage: true,
  assessTriage: true,
  viewConsultation: true,
  viewOrders: true,
  viewDisposition: true,
  viewDocuments: true,
  createDocuments: true,
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
  viewDocuments: true,
  createDocuments: true,
  viewReferral: true,
});

const makeEncounters = (currentUserId: string) => [
  {
    id: 'enc-1',
    encounter_number: 'ER-0001',
    emergency_identifier: 'ER-A001',
    patient_name: 'Alice Smith',
    patient_number: 'MRN-001',
    provisional_identity: null,
    arrival_mode: 'Ambulance',
    arrival_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    chief_complaint: 'Chest pain',
    status: 'WAITING_FOR_TRIAGE' as const,
    triage: null,
    assigned_doctor_id: null,
    assigned_doctor_name: null,
    orders: [],
    created_at: new Date().toISOString(),
  },
  {
    id: 'enc-2',
    encounter_number: 'ER-0002',
    emergency_identifier: 'ER-A002',
    patient_name: 'Bob Jones',
    patient_number: 'MRN-002',
    provisional_identity: { display_name: 'Bob Jones', estimated_age: 40, gender: 'MALE', contact: null, identity_notes: null },
    arrival_mode: 'Walk-in',
    arrival_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    chief_complaint: 'Fracture',
    status: 'IN_CONSULTATION' as const,
    triage: { level: 'LEVEL_2_HIGH', effective_level: 'LEVEL_2_HIGH', area: 'A', nurse_user_id: 'n1', assessed_at: '', pain_score: null, vitals: {}, abcde: {}, notes: null },
    assigned_doctor_id: currentUserId,
    assigned_doctor_name: 'Dr. Current',
    orders: [{ order_type: 'LABORATORY', downstream_id: 'o1', source_type: 'EMERGENCY_ENCOUNTER', source_id: 'enc-2', status: 'PENDING', created_at: '', created_by: '' }],
    created_at: new Date().toISOString(),
  },
  {
    id: 'enc-3',
    encounter_number: 'ER-0003',
    emergency_identifier: 'ER-A003',
    patient_name: 'Carol White',
    patient_number: 'MRN-003',
    provisional_identity: null,
    arrival_mode: 'Walk-in',
    arrival_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    chief_complaint: 'Headache',
    status: 'IN_CONSULTATION' as const,
    triage: { level: 'LEVEL_3_MEDIUM', effective_level: 'LEVEL_3_MEDIUM', area: 'B', nurse_user_id: 'n1', assessed_at: '', pain_score: null, vitals: {}, abcde: {}, notes: null },
    assigned_doctor_id: 'other-doctor-id',
    assigned_doctor_name: 'Dr. Other',
    orders: [],
    created_at: new Date().toISOString(),
  },
];

// ─── Test state controllable via closure ──────────────────────────────────────

const testState = vi.hoisted(() => ({
  // Start with empty caps — each test's beforeEach sets the real value.
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
  currentUserId: 'user-123' as string,
  currentDoctorId: 'doc-1' as string,
  dashboardProfile: 'receptionist' as 'doctor' | 'nurse' | 'receptionist' | 'viewer',
  encounters: [] as ReturnType<typeof makeEncounters>,
}));

vi.mock('../hooks/emergency/useEmergencyWorkspaceFeature', () => ({
  useEmergencyWorkspaceFeature: () => ({
    state: {
      branchId: 'branch-1',
      branches: [{ id: 'branch-1', name: 'Main Branch' }],
      departments: [{ id: 'dept-1', name: 'Emergency' }],
      doctors: [{ id: 'doc-1', display_name: 'Dr. Test', user_id: 'user-123' }],
      currentDoctor: { id: 'doc-1', display_name: 'Dr. Test', user_id: 'user-123' },
      currentDoctorId: testState.currentDoctorId,
      currentUserId: testState.currentUserId,
      patients: [],
      patientSearch: '',
      selectedId: null,
      encounters: testState.encounters,
      listQuery: { isLoading: false },
      capabilities: testState.caps,
      dashboardProfile: testState.dashboardProfile,
      loading: false,
      error: null,
      pending: {
        triage: false,
        consultation: false,
        order: false,
        referral: false,
        disposition: false,
        linkPatient: false,
        overridePriority: false,
      },
    },
    actions: {
      setBranchId: vi.fn(),
      setPatientSearch: vi.fn(),
    },
    mutations: {
      create: { isPending: false },
    },
  }),
}));

vi.mock('../routing/navigation', () => ({
  navigate: vi.fn(),
  useAppLocation: () => ({
    pathname: '/emergency',
    search: '?branch_id=branch-1',
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('../components/ui/Modal', () => ({
  Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="modal">{children}</div> : null,
}));

import React from 'react';
import { EmergencyDashboardPage } from './EmergencyDashboardPage';

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('EmergencyDashboardPage – role-based dashboard rendering', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  // ─── RECEPTIONIST ──────────────────────────────────────────────────────────

  describe('Receptionist profile', () => {
    beforeEach(() => {
      testState.caps = RECEPTIONIST_CAPS;
      testState.dashboardProfile = 'receptionist';
      testState.encounters = makeEncounters('user-123');
    });

    it('shows the receptionist KPI section', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="kpi-receptionist"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="kpi-nurse"]')).toBeNull();
      expect(container.querySelector('[data-testid="kpi-doctor"]')).toBeNull();
    });

    it('shows Register Emergency Encounter quick action when register capability is granted', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="qa-register"]')).not.toBeNull();
    });

    it('shows Find/Link Patient quick action when linkPatient capability is granted', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="qa-link-patient"]')).not.toBeNull();
    });

    it('shows Emergency Queue quick action', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      const qa = container.querySelector('[data-testid="quick-actions-receptionist"]');
      expect(qa).not.toBeNull();
      expect(qa!.textContent).toContain('Emergency Queue');
    });

    it('does NOT show nurse triage quick action', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="qa-start-triage"]')).toBeNull();
    });

    it('does NOT show doctor consultation quick action', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="qa-start-consultation"]')).toBeNull();
    });

    it('does NOT show doctor disposition quick action', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="qa-disposition"]')).toBeNull();
    });

    it('does NOT show bed availability widget to receptionist', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="bed-availability"]')).toBeNull();
    });

    it('shows queue with admin columns (Arrival Time, Arrival Mode)', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.textContent).toContain('Arrival Time');
      expect(container.textContent).toContain('Arrival Mode');
    });

    it('does NOT render a "Register Patient" header button when capabilities.register is false', async () => {
      testState.caps = { ...RECEPTIONIST_CAPS, register: false };
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="header-register-btn"]')).toBeNull();
      expect(container.querySelector('[data-testid="qa-register"]')).toBeNull();
    });

    it('shows the administrative queue title', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.textContent).toContain('Administrative Emergency Queue');
    });

    it('shows receptionist-profile page subtitle', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.textContent).toContain('Emergency registration, patient identification and administrative queue');
    });
  });

  // ─── NURSE ────────────────────────────────────────────────────────────────

  describe('Nurse profile', () => {
    beforeEach(() => {
      testState.caps = NURSE_CAPS;
      testState.dashboardProfile = 'nurse';
      testState.encounters = makeEncounters('user-123');
    });

    it('shows the nurse KPI section', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="kpi-nurse"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="kpi-receptionist"]')).toBeNull();
      expect(container.querySelector('[data-testid="kpi-doctor"]')).toBeNull();
    });

    it('shows Start Triage quick action when assessTriage is granted', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="qa-start-triage"]')).not.toBeNull();
    });

    it('shows Awaiting Triage quick action', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="qa-awaiting-triage"]')).not.toBeNull();
    });

    it('shows Emergency Queue quick action', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      const qa = container.querySelector('[data-testid="quick-actions-nurse"]');
      expect(qa).not.toBeNull();
      expect(qa!.textContent).toContain('Emergency Queue');
    });

    it('does NOT show Register Emergency Encounter as a quick action', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="qa-register"]')).toBeNull();
    });

    it('does NOT show doctor consultation quick action', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="qa-start-consultation"]')).toBeNull();
    });

    it('does NOT show doctor disposition quick action', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="qa-disposition"]')).toBeNull();
    });

    it('shows bed availability widget to nurse as read-only operational context', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="bed-availability"]')).not.toBeNull();
    });

    it('shows bed widget with no assignment controls', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      const bedWidget = container.querySelector('[data-testid="bed-availability"]');
      expect(bedWidget).not.toBeNull();
      // The bed widget is read-only — no buttons inside it
      const buttons = bedWidget!.querySelectorAll('button');
      expect(buttons.length).toBe(0);
    });

    it('does NOT render a Register Patient header button (nurse has no register capability)', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="header-register-btn"]')).toBeNull();
    });

    it('shows nursing-profile page subtitle', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.textContent).toContain('Triage, vitals, nursing assessment and patient monitoring');
    });

    it('shows triage-focused queue title', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.textContent).toContain('Emergency Triage Queue');
    });
  });

  // ─── DOCTOR ───────────────────────────────────────────────────────────────

  describe('Doctor profile', () => {
    beforeEach(() => {
      testState.caps = DOCTOR_CAPS;
      testState.dashboardProfile = 'doctor';
      testState.currentUserId = 'user-123';
      testState.encounters = makeEncounters('user-123');
    });

    it('shows the doctor KPI section', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="kpi-doctor"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="kpi-receptionist"]')).toBeNull();
      expect(container.querySelector('[data-testid="kpi-nurse"]')).toBeNull();
    });

    it('shows My Emergency Cases quick action', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="qa-my-cases"]')).not.toBeNull();
    });

    it('shows Start Consultation quick action when editConsultation is granted', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="qa-start-consultation"]')).not.toBeNull();
    });

    it('shows Review Results quick action', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="qa-review-results"]')).not.toBeNull();
    });

    it('shows Complete Disposition quick action when disposition capabilities are granted', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="qa-disposition"]')).not.toBeNull();
    });

    it('does NOT show Register Emergency Encounter as a quick action', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="qa-register"]')).toBeNull();
    });

    it('does NOT show the nurse triage quick action', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="qa-start-triage"]')).toBeNull();
    });

    it('does NOT render a Register Patient header button (doctor has no register capability)', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="header-register-btn"]')).toBeNull();
    });

    it('filters queue to show only assigned-to-me and unassigned encounters (not other doctors)', async () => {
      // enc-1: unassigned → visible
      // enc-2: assigned to currentUserId → visible
      // enc-3: assigned to 'other-doctor-id' → NOT visible
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.textContent).toContain('Alice Smith');   // enc-1 (unassigned)
      expect(container.textContent).toContain('Bob Jones');     // enc-2 (assigned to me)
      expect(container.textContent).not.toContain('Carol White'); // enc-3 (other doctor)
    });

    it('correctly matches assigned cases when assigned_doctor_id is Doctor entity ID (doc-1)', async () => {
      testState.currentDoctorId = 'doc-1';
      testState.currentUserId = 'user-123';
      testState.encounters = [
        {
          id: 'enc-doc-entity',
          encounter_number: 'ER-0010',
          emergency_identifier: 'ER-A010',
          patient_name: 'David Brown',
          patient_number: 'MRN-010',
          provisional_identity: null,
          arrival_mode: 'Ambulance',
          arrival_at: new Date().toISOString(),
          chief_complaint: 'Chest pain',
          status: 'IN_CONSULTATION' as const,
          triage: { level: 'LEVEL_1_CRITICAL', effective_level: 'LEVEL_1_CRITICAL', area: 'A', nurse_user_id: 'n1', assessed_at: '', pain_score: null, vitals: {}, abcde: {}, notes: null },
          assigned_doctor_id: 'doc-1', // Doctor._id entity match
          assigned_doctor_name: 'Dr. Test',
          orders: [],
          created_at: new Date().toISOString(),
        },
        {
          id: 'enc-other-doc',
          encounter_number: 'ER-0011',
          emergency_identifier: 'ER-A011',
          patient_name: 'Eve Green',
          patient_number: 'MRN-011',
          provisional_identity: null,
          arrival_mode: 'Walk-in',
          arrival_at: new Date().toISOString(),
          chief_complaint: 'Sprain',
          status: 'IN_CONSULTATION' as const,
          triage: { level: 'LEVEL_3_MEDIUM', effective_level: 'LEVEL_3_MEDIUM', area: 'B', nurse_user_id: 'n1', assessed_at: '', pain_score: null, vitals: {}, abcde: {}, notes: null },
          assigned_doctor_id: 'doc-999', // Different doctor entity ID
          assigned_doctor_name: 'Dr. Other',
          orders: [],
          created_at: new Date().toISOString(),
        },
      ];

      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.textContent).toContain('David Brown'); // Assigned to doc-1 -> visible
      expect(container.textContent).not.toContain('Eve Green');  // Assigned to doc-999 -> excluded
    });

    it('shows My Emergency Cases queue title', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.textContent).toContain('My Emergency Cases');
    });

    it('shows doctor-profile page subtitle', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.textContent).toContain('Clinical consultation, diagnosis, orders and disposition');
    });

    it('shows bed availability widget to doctor as operational context', async () => {
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="bed-availability"]')).not.toBeNull();
    });
  });

  // ─── CROSS-ROLE INVARIANTS ────────────────────────────────────────────────

  describe('Cross-role invariants', () => {
    it('all profiles show ER Alerts panel', async () => {
      for (const [caps, profile] of [
        [RECEPTIONIST_CAPS, 'receptionist'],
        [NURSE_CAPS, 'nurse'],
        [DOCTOR_CAPS, 'doctor'],
      ] as const) {
        testState.caps = caps;
        testState.dashboardProfile = profile;
        testState.encounters = [];
        await act(async () => root.render(<EmergencyDashboardPage />));
        // ER Alerts card is always present
        expect(container.textContent).toContain('ER Alerts');
      }
    });

    it('all profiles have Quick Actions panel', async () => {
      for (const [caps, profile] of [
        [RECEPTIONIST_CAPS, 'receptionist'],
        [NURSE_CAPS, 'nurse'],
        [DOCTOR_CAPS, 'doctor'],
      ] as const) {
        testState.caps = caps;
        testState.dashboardProfile = profile;
        testState.encounters = [];
        await act(async () => root.render(<EmergencyDashboardPage />));
        expect(container.querySelector('[data-testid="quick-actions-panel"]')).not.toBeNull();
        expect(container.textContent).toContain('Quick Actions');
      }
    });

    it('bed availability is NOT shown to receptionist', async () => {
      testState.caps = RECEPTIONIST_CAPS;
      testState.dashboardProfile = 'receptionist';
      testState.encounters = [];
      await act(async () => root.render(<EmergencyDashboardPage />));
      expect(container.querySelector('[data-testid="bed-availability"]')).toBeNull();
    });
  });
});
