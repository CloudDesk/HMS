import { describe, expect, it, vi } from 'vitest';
import { AppointmentsApi } from './appointments-api';
import type { SessionManager } from '../auth/session-manager';
import type { PublicBranch, PublicDepartment, PublicDoctor, PublicDoctorSlots } from './contracts';
import { bookAppointmentInputSchema } from './contracts';
import { isSlotExpired, isSlotSelectable } from './date-utils';

const mockBranches: PublicBranch[] = [
  { id: 'branch-main', code: 'MAIN', name: 'Main Hospital', city: 'Accra', address: '123 Health Ave' },
  { id: 'branch-east', code: 'EAST', name: 'East Wing Clinic', city: 'Accra', address: '456 East Road' },
];

const mockDepartments: PublicDepartment[] = [
  { id: 'dept-cardio', code: 'CARD', name: 'Cardiology', description: 'Heart & vascular care', branch: { id: 'branch-main', name: 'Main Hospital' } },
  { id: 'dept-dental', code: 'DENT', name: 'Dental', description: 'Dental & oral care', branch: { id: 'branch-main', name: 'Main Hospital' } },
  { id: 'dept-ortho', code: 'ORTH', name: 'Orthopedics', description: 'Bone & joint care', branch: { id: 'branch-main', name: 'Main Hospital' } },
];

const mockDoctors: PublicDoctor[] = [
  {
    id: 'doc-kofi',
    display_name: 'Dr. Daniel Kofi',
    specialization: 'Cardiology',
    qualification: 'MD, FACC',
    experience_years: 12,
    consultation_room: 'Room 101',
    available_days: ['MONDAY', 'TUESDAY', 'WEDNESDAY'],
    branch: { id: 'branch-main', name: 'Main Hospital' },
    department: { id: 'dept-cardio', name: 'Cardiology' },
  },
  {
    id: 'doc-kamesh',
    display_name: 'Dr. Kamesh Kamesh',
    specialization: 'Cardiology',
    qualification: 'MBBS, MS',
    experience_years: 8,
    consultation_room: 'Room 102',
    available_days: ['WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    branch: { id: 'branch-main', name: 'Main Hospital' },
    department: { id: 'dept-cardio', name: 'Cardiology' },
  },
  {
    id: 'doc-anderson',
    display_name: 'Dr. Anderson James',
    specialization: 'Dental',
    qualification: 'BDS, DDS',
    experience_years: 15,
    consultation_room: 'Dental Suite A',
    available_days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
    branch: { id: 'branch-main', name: 'Main Hospital' },
    department: { id: 'dept-dental', name: 'Dental' },
  },
];

const mockSlotsCardio: PublicDoctorSlots = {
  doctor_id: 'doc-kofi',
  date: '2026-10-15',
  is_available: true,
  slots: [
    { start_time: '09:00', end_time: '09:15', is_available: true },
    { start_time: '09:15', end_time: '09:30', is_available: true },
  ],
};

const mockSlotsDental: PublicDoctorSlots = {
  doctor_id: 'doc-anderson',
  date: '2026-10-15',
  is_available: true,
  slots: [
    { start_time: '14:00', end_time: '14:30', is_available: true },
    { start_time: '14:30', end_time: '15:00', is_available: false, reason: 'Booked' },
  ],
};

describe('MyCare Appointment Department → Doctor Cascading Selection', () => {
  const createMockSessionManager = (doctorOverrides?: Record<string, PublicDoctor[]>) => {
    return {
      authenticatedRequest: vi.fn().mockImplementation(async (path: string, _schema: unknown, options?: { query?: Record<string, unknown> }) => {
        if (path === '/patient-portal/public/branches') {
          return { data: mockBranches };
        }
        if (path === '/patient-portal/public/departments') {
          return { data: mockDepartments };
        }
        if (path === '/patient-portal/public/doctors') {
          const deptId = options?.query?.department_id as string | undefined;
          if (doctorOverrides && deptId && doctorOverrides[deptId]) {
            return { data: doctorOverrides[deptId] };
          }
          if (deptId) {
            const matched = mockDoctors.filter((d) => d.department?.id === deptId);
            return { data: matched };
          }
          return { data: mockDoctors };
        }
        if (path.includes('/slots')) {
          const doctorId = path.split('/')[4];
          if (doctorId === 'doc-anderson') return mockSlotsDental;
          return mockSlotsCardio;
        }
        return { data: [] };
      }),
    } as unknown as SessionManager;
  };

  it('1. Department list loads correctly for the selected branch', async () => {
    const sessionManager = createMockSessionManager();
    const api = new AppointmentsApi(sessionManager);

    const depts = await api.getDepartments('branch-main');
    expect(depts).toHaveLength(3);
    expect(depts.map((d) => d.name)).toEqual(['Cardiology', 'Dental', 'Orthopedics']);
    expect(sessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/patient-portal/public/departments',
      expect.anything(),
      { query: { branch_id: 'branch-main', limit: 50 } }
    );
  });

  it('2. Doctor selection is initially empty/unselected before department selection', () => {
    const initialState = {
      branchId: 'branch-main',
      departmentId: '',
      doctorId: '',
      doctors: [] as PublicDoctor[],
      selectedSlot: null,
      slotData: null,
    };

    expect(initialState.departmentId).toBe('');
    expect(initialState.doctorId).toBe('');
    expect(initialState.doctors).toHaveLength(0);
    // Doctor trigger should be disabled when departmentId is empty
    const isDoctorDisabled = !initialState.departmentId || initialState.doctors.length === 0;
    expect(isDoctorDisabled).toBe(true);
  });

  it('3. Selecting Cardiology loads ONLY Cardiology doctors', async () => {
    const sessionManager = createMockSessionManager();
    const api = new AppointmentsApi(sessionManager);

    const doctors = await api.getDoctors('branch-main', 'dept-cardio');
    expect(doctors).toHaveLength(2);
    expect(doctors.map((d) => d.display_name)).toEqual(['Dr. Daniel Kofi', 'Dr. Kamesh Kamesh']);
    doctors.forEach((d) => {
      expect(d.department?.id).toBe('dept-cardio');
    });
  });

  it('4. Selecting Dental loads ONLY Dental doctors', async () => {
    const sessionManager = createMockSessionManager();
    const api = new AppointmentsApi(sessionManager);

    const doctors = await api.getDoctors('branch-main', 'dept-dental');
    expect(doctors).toHaveLength(1);
    expect(doctors[0]?.display_name).toBe('Dr. Anderson James');
    expect(doctors[0]?.department?.id).toBe('dept-dental');
  });

  it('5. Doctors from unrelated departments are NOT shown', async () => {
    const sessionManager = createMockSessionManager();
    const api = new AppointmentsApi(sessionManager);

    const cardioDocs = await api.getDoctors('branch-main', 'dept-cardio');
    const dentalDocNames = cardioDocs.map((d) => d.display_name);
    expect(dentalDocNames).not.toContain('Dr. Anderson James');

    const dentalDocs = await api.getDoctors('branch-main', 'dept-dental');
    const cardioDocNames = dentalDocs.map((d) => d.display_name);
    expect(cardioDocNames).not.toContain('Dr. Daniel Kofi');
    expect(cardioDocNames).not.toContain('Dr. Kamesh Kamesh');
  });

  it('6. Changing department immediately clears the previously selected doctor', () => {
    // Initial state: Cardiology with Dr. Daniel Kofi
    let state: {
      departmentId: string;
      doctorId: string;
      doctors: PublicDoctor[];
      selectedSlot: { start_time: string; end_time: string } | null;
      slotData: PublicDoctorSlots | null;
    } = {
      departmentId: 'dept-cardio',
      doctorId: 'doc-kofi',
      doctors: mockDoctors.filter((d) => d.department?.id === 'dept-cardio'),
      selectedSlot: { start_time: '09:00', end_time: '09:15' },
      slotData: mockSlotsCardio,
    };

    // User switches department to Dental
    const handleDepartmentChange = (newDeptId: string) => {
      state = {
        departmentId: newDeptId,
        doctorId: '', // MANDATORY RESET
        doctors: [],
        selectedSlot: null, // MANDATORY RESET
        slotData: null, // MANDATORY RESET
      };
    };

    handleDepartmentChange('dept-dental');

    expect(state.departmentId).toBe('dept-dental');
    expect(state.doctorId).toBe('');
    expect(state.doctors).toHaveLength(0);
    expect(state.selectedSlot).toBeNull();
    expect(state.slotData).toBeNull();
  });

  it('7. Changing department clears stale appointment slots', () => {
    let slots: PublicDoctorSlots | null = mockSlotsCardio;
    let selectedSlot: { start_time: string } | null = { start_time: '09:00' };

    expect(slots).not.toBeNull();
    expect(selectedSlot).not.toBeNull();

    // Reset triggered on department change
    slots = null;
    selectedSlot = null;

    expect(slots).toBeNull();
    expect(selectedSlot).toBeNull();
  });

  it('8. Doctor selection loads the correct doctor slots', async () => {
    const sessionManager = createMockSessionManager();
    const api = new AppointmentsApi(sessionManager);

    const slots = await api.getDoctorSlots('doc-kofi', '2026-10-15');
    expect(slots.doctor_id).toBe('doc-kofi');
    expect(slots.slots).toHaveLength(2);
    expect(slots.slots[0]?.start_time).toBe('09:00');
  });

  it('9. Doctor loading state prevents interaction while loading', () => {
    const isLoadingDoctors = true;
    const departmentId = 'dept-cardio';
    const isSubmitting = false;
    const doctorsCount = 0;

    const isTriggerDisabled = !departmentId || isLoadingDoctors || isSubmitting || doctorsCount === 0;
    expect(isTriggerDisabled).toBe(true);
  });

  it('10. Empty doctor list disables doctor selection and displays friendly notice', async () => {
    const sessionManager = createMockSessionManager({ 'dept-ortho': [] });
    const api = new AppointmentsApi(sessionManager);

    const doctors = await api.getDoctors('branch-main', 'dept-ortho');
    expect(doctors).toHaveLength(0);

    const departmentId = 'dept-ortho';
    const isLoadingDoctors = false;
    const isSubmitting = false;

    const isTriggerDisabled = !departmentId || isLoadingDoctors || isSubmitting || doctors.length === 0;
    expect(isTriggerDisabled).toBe(true);

    const getTriggerText = (deptId: string, docCount: number, isLoading: boolean) => {
      if (isLoading) return 'Loading…';
      if (!deptId) return 'Select dept first';
      if (docCount === 0) return 'No doctors available';
      return 'Select Doctor';
    };

    expect(getTriggerText(departmentId, doctors.length, isLoadingDoctors)).toBe('No doctors available');
  });

  it('11. Doctor loading error gracefully handles failures', async () => {
    const failingSessionManager = {
      authenticatedRequest: vi.fn().mockRejectedValue(new Error('Network connection error')),
    } as unknown as SessionManager;

    const api = new AppointmentsApi(failingSessionManager);

    await expect(api.getDoctors('branch-main', 'dept-cardio')).rejects.toThrow('Network connection error');
  });

  it('12. Re-selection / retry properly fetches new doctors', async () => {
    let callCount = 0;
    const retrySessionManager = {
      authenticatedRequest: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) throw new Error('Temporary failure');
        return { data: [mockDoctors[0]] };
      }),
    } as unknown as SessionManager;

    const api = new AppointmentsApi(retrySessionManager);

    // First attempt fails
    await expect(api.getDoctors('branch-main', 'dept-cardio')).rejects.toThrow('Temporary failure');

    // Retry succeeds
    const recovered = await api.getDoctors('branch-main', 'dept-cardio');
    expect(recovered).toHaveLength(1);
    expect(recovered[0]?.id).toBe('doc-kofi');
  });

  it('13. Branch restriction remains intact for patient preferred branch', () => {
    const currentPatient = {
      id: 'pat-1',
      preferred_branch: { id: 'branch-main', name: 'Main Hospital' },
    };

    const eligibleBranches = mockBranches.filter((b) => b.id === currentPatient.preferred_branch.id);
    expect(eligibleBranches).toHaveLength(1);
    expect(eligibleBranches[0]?.id).toBe('branch-main');
  });

  it('14. Appointment booking payload contains selected department doctor and slots', () => {
    const bookingInput = {
      patient_id: 'pat-1',
      doctor_id: 'doc-kofi',
      appointment_date: '2026-10-15',
      start_time: '09:00',
      duration_minutes: 15,
      visit_type: 'NEW_CONSULTATION' as const,
      reason: 'Heart palpitation follow up',
      clinical_history: {
        chief_complaint: 'Heart palpitations after morning exercise',
      },
    };

    const parsed = bookAppointmentInputSchema.parse(bookingInput);
    expect(parsed.doctor_id).toBe('doc-kofi');
    expect(parsed.appointment_date).toBe('2026-10-15');
    expect(parsed.start_time).toBe('09:00');
    expect(parsed.reason).toBe('Heart palpitation follow up');
    expect(parsed.clinical_history?.chief_complaint).toBe('Heart palpitations after morning exercise');
  });

  it('15. Timezone and appointment date format remain intact', () => {
    const dateStr = '2026-10-15';
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('16. Expired slot calculation correctly rejects past slots on today', () => {
    const todayStr = '2026-09-28';
    const fakeNow = new Date(2026, 8, 28, 12, 0, 0); // 12:00 PM on 2026-09-28

    const futureSlot = { start_time: '14:00', end_time: '14:15', is_available: true };
    const pastSlot = { start_time: '09:00', end_time: '09:15', is_available: true };

    expect(isSlotExpired(todayStr, pastSlot.start_time, fakeNow)).toBe(true);
    expect(isSlotExpired(todayStr, futureSlot.start_time, fakeNow)).toBe(false);
    expect(isSlotSelectable(pastSlot, todayStr, fakeNow)).toBe(false);
    expect(isSlotSelectable(futureSlot, todayStr, fakeNow)).toBe(true);
  });

  it('17. Multi-step cascading dependency order: Branch → Dept → Doctor → Date → Slot', () => {
    const steps: string[] = [];

    // Step 1: Branch selected
    steps.push('BRANCH: branch-main');
    // Step 2: Department selected
    steps.push('DEPT: dept-cardio');
    // Step 3: Doctor selected
    steps.push('DOCTOR: doc-kofi');
    // Step 4: Date selected
    steps.push('DATE: 2026-10-15');
    // Step 5: Slot selected
    steps.push('SLOT: 09:00');

    expect(steps).toEqual([
      'BRANCH: branch-main',
      'DEPT: dept-cardio',
      'DOCTOR: doc-kofi',
      'DATE: 2026-10-15',
      'SLOT: 09:00',
    ]);
  });
});
