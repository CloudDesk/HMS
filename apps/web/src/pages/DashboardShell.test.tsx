// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AuthPermission, AuthUser } from '../auth/auth-types';

const testState = vi.hoisted(() => ({
  search: '',
  navigate: vi.fn(),
  refresh: vi.fn(),
  executiveHook: vi.fn(() => ({
    data: {
      kpis: {
        activeDoctors: 0,
        todayAppointments: 0,
        todayBilledRevenue: 0,
        todayOpdVisits: 0,
        registeredPatients: 0,
      },
      operationalMetrics: {
        patientsWaiting: 0,
        patientsInConsultation: 0,
        completedConsultationsToday: 0,
      },
      recentVisits: [],
      trend: [],
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    hasData: true,
    canViewExecutive: true,
    refresh: vi.fn(),
  })),
  user: null as AuthUser | null,
}));

vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: testState.user }) }));
vi.mock('../routing/navigation', () => ({
  navigate: testState.navigate,
  useAppLocation: () => ({ pathname: '/dashboard', search: testState.search }),
}));
vi.mock('../hooks/dashboard/useDashboardOverviewFeature', () => ({
  useDashboardOverviewFeature: testState.executiveHook,
}));
vi.mock('../api/useSettings', () => ({ useCurrencyFormatter: () => (value: number) => `$${value}` }));

vi.mock('./DoctorDashboardPage', () => ({ DoctorDashboardPage: () => 'Doctor dashboard content' }));
vi.mock('./AppointmentDashboardPage', () => ({ AppointmentDashboardPage: () => 'Appointment dashboard content' }));
vi.mock('./OpdDashboardPage', () => ({ OpdDashboardPage: () => 'OPD dashboard content' }));
vi.mock('./BillingDashboardPage', () => ({ BillingDashboardPage: () => 'Billing dashboard content' }));
vi.mock('./AdministrationDashboardPage', () => ({ AdministrationDashboardPage: () => 'Administration dashboard content' }));
vi.mock('./EmergencyDashboardPage', () => ({ EmergencyDashboardPage: () => 'Emergency dashboard content' }));
vi.mock('./InpatientAdmissionPage', () => ({ InpatientAdmissionPage: () => 'Admissions dashboard content' }));
vi.mock('./SurgeryWorkspacePage', () => ({ SurgeryWorkspacePage: () => 'Surgery dashboard content' }));
vi.mock('./PharmacyQueueDashboardPage', () => ({ PharmacyQueueDashboardPage: () => 'Pharmacy queue content' }));
vi.mock('./PharmacyInventoryDashboardPage', () => ({ PharmacyInventoryDashboardPage: () => 'Pharmacy inventory content' }));
vi.mock('./LaboratoryDashboardPage', () => ({ LaboratoryDashboardPage: () => 'Laboratory queue content' }));
vi.mock('./ImagingDashboardPage', () => ({ ImagingDashboardPage: () => 'Imaging queue content' }));

import { DashboardShell } from './DashboardShell';

const authPermission = (module: string, screen: string, action = 'View'): AuthPermission => ({
  code: `${module}_${screen}_${action}`,
  module,
  screen,
  action,
});

const user = (roleCode: string, permissions: AuthPermission[]): AuthUser => ({
  id: `${roleCode.toLowerCase()}-user`,
  username: roleCode.toLowerCase(),
  email: `${roleCode.toLowerCase()}@example.test`,
  fullName: `${roleCode} User`,
  status: 'active',
  lastLoginAt: null,
  patientId: null,
  branches: [{ id: 'branch-1', code: 'MB01', name: 'Main Branch' }],
  permissions,
  roles: [{ id: `${roleCode.toLowerCase()}-role`, code: roleCode, name: roleCode }],
});

describe('permission-driven dashboard shell', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    testState.search = '';
    testState.navigate.mockReset();
    testState.refresh.mockReset();
    testState.executiveHook.mockImplementation(() => ({
      data: {
        kpis: {
          activeDoctors: 0,
          todayAppointments: 0,
          todayBilledRevenue: 0,
          todayOpdVisits: 0,
          registeredPatients: 0,
        },
        operationalMetrics: {
          patientsWaiting: 0,
          patientsInConsultation: 0,
          completedConsultationsToday: 0,
        },
        recentVisits: [],
        trend: [],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      hasData: true,
      canViewExecutive: true,
      refresh: testState.refresh,
    }));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = async (children: ReactNode = <DashboardShell />) => {
    testState.executiveHook.mockClear();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => root.render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>));
  };

  it('keeps Billing out of the Super Admin dashboard', async () => {
    testState.user = user('SUPER_ADMIN', []);
    await render();

    expect(container.textContent).toContain('Overview');
    expect(container.textContent).toContain('Doctors');
    expect(container.textContent).toContain('Appointments');
    expect(container.textContent).toContain('OPD');
    expect(container.textContent).toContain('Administration');
    expect(container.textContent).toContain('Hospital Executive Overview');
    expect(container.textContent).not.toContain('Billing');
    expect(container.textContent).not.toContain('Billed Revenue');
    expect(container.textContent).not.toContain('Financial Settlement');
    expect(testState.executiveHook).toHaveBeenCalledTimes(1);
  });

  it('switches dashboard components without navigation', async () => {
    testState.user = user('SUPER_ADMIN', []);
    await render();

    const appointmentsTab = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Appointments'));
    await act(async () => appointmentsTab?.click());

    expect(container.textContent).toContain('Appointment dashboard content');
    expect(testState.navigate).not.toHaveBeenCalled();
  });

  it('uses live schedule data and wires refresh, range, and calendar controls', async () => {
    testState.user = user('SUPER_ADMIN', []);
    testState.executiveHook.mockImplementation(() => ({
      data: {
        kpis: {
          activeDoctors: 4,
          todayAppointments: 7,
          todayBilledRevenue: null,
          todayOpdVisits: 3,
          registeredPatients: 42,
        },
        operationalMetrics: {
          patientsWaiting: 2,
          patientsInConsultation: 1,
          completedConsultationsToday: 5,
        },
        recentVisits: [],
        scheduleItems: [{
          id: 'appointment-1',
          source: 'APPOINTMENT' as const,
          patient_name: 'Jane Patient',
          doctor_name: 'Dr. Live Doctor',
          scheduled_at: new Date().toISOString(),
          status: 'CONFIRMED',
          appointment_id: 'appointment-1',
          visit_id: null,
        }],
        trend: [{ date: '2026-10-08', day: 'Thu 8', revenue: 0, encounters: 3 }],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      hasData: true,
      canViewExecutive: true,
      refresh: testState.refresh,
    }));
    await render();

    expect(container.textContent).toContain('42');
    expect(container.textContent).toContain('Appointment: Jane Patient');

    const refreshButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Refresh'));
    await act(async () => refreshButton?.click());
    expect(testState.refresh).toHaveBeenCalledTimes(1);

    const monthButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Month');
    await act(async () => monthButton?.click());
    const callsAfterRange = testState.executiveHook.mock.calls as unknown as Array<[string, string]>;
    expect(callsAfterRange.at(-1)?.[0]).toBe('month');

    const initialScheduleDate = callsAfterRange.at(-1)?.[1];
    const nextWeekButton = container.querySelector<HTMLButtonElement>('button[aria-label="Next week"]');
    await act(async () => nextWeekButton?.click());
    const callsAfterCalendar = testState.executiveHook.mock.calls as unknown as Array<[string, string]>;
    expect(callsAfterCalendar.at(-1)?.[1]).not.toBe(initialScheduleDate);

    const scheduleEvent = Array.from(container.querySelectorAll<HTMLElement>('[role="button"]'))
      .find((element) => element.textContent?.includes('Appointment: Jane Patient'));
    await act(async () => scheduleEvent?.click());
    expect(container.textContent).toContain('Appointment dashboard content');
  });

  it('does not mount Billing for a Super Admin stale billing tab URL', async () => {
    testState.search = '?tab=billing';
    testState.user = user('SUPER_ADMIN', [authPermission('Billing', 'Invoices')]);
    await render();

    expect(container.textContent).toContain('Hospital Executive Overview');
    expect(container.textContent).not.toContain('Billing dashboard content');
  });

  it('renders a doctor-focused dashboard without executive, billing, or administration work', async () => {
    testState.user = user('DOCTOR', [
      authPermission('Doctors', 'Doctor Directory'),
      authPermission('Appointments', 'Appointment Records'),
      authPermission('OPD', 'OPD Visits'),
    ]);
    await render();

    expect(container.textContent).toContain('My Clinical Day');
    expect(container.textContent).toContain('Doctor dashboard content');
    expect(container.textContent).toContain('OPD');
    expect(container.textContent).not.toContain('Billing');
    expect(container.textContent).not.toContain('Administration');
    expect(container.textContent).not.toContain('Hospital Executive Overview');
    expect(testState.executiveHook).not.toHaveBeenCalled();
  });

  it('does not mount a manually requested unauthorized dashboard tab', async () => {
    testState.search = '?tab=billing';
    testState.user = user('DOCTOR', [
      authPermission('Doctors', 'Doctor Directory'),
      authPermission('Appointments', 'Appointment Records'),
    ]);
    await render();

    expect(container.textContent).toContain('Doctor dashboard content');
    expect(container.textContent).not.toContain('Billing dashboard content');
    expect(testState.executiveHook).not.toHaveBeenCalled();
  });

  it('does not expose an Emergency shortcut dashboard', async () => {
    testState.search = '?tab=emergency';
    testState.user = user('CLINICIAN_NURSE', [
      authPermission('OPD', 'OPD Visits'),
      authPermission('Emergency', 'Encounters'),
    ]);
    await render();

    expect(container.textContent).toContain('OPD dashboard content');
    expect(container.textContent).not.toContain('Emergency');
    expect(container.textContent).not.toContain('Emergency dashboard content');
    expect(testState.executiveHook).not.toHaveBeenCalled();
  });

  it.each([
    ['emergency', authPermission('Emergency', 'Encounters')],
    ['admissions', authPermission('Admissions', 'Inpatient Admissions')],
    ['surgery', authPermission('Surgery', 'Recommendations')],
  ])('shows no dashboard shortcut when %s is the only permitted module', async (tab, permission) => {
    testState.search = `?tab=${tab}`;
    testState.user = user('CUSTOM_OPERATIONAL', [permission]);
    await render();

    expect(container.textContent).toContain('No dashboard summary is available');
    expect(container.textContent).not.toContain('Open permitted workspace');
    expect(testState.navigate).not.toHaveBeenCalled();
    expect(testState.executiveHook).not.toHaveBeenCalled();
  });

  it('selects operational dashboards from permissions for non-clinical roles', async () => {
    testState.user = user('PHARMACY_USER', [
      authPermission('Pharmacy', 'Dispensing'),
      authPermission('Pharmacy', 'Medicine Inventory'),
    ]);
    await render();

    expect(container.textContent).toContain('Pharmacy Queue');
    expect(container.textContent).toContain('Pharmacy Inventory');
    expect(container.textContent).toContain('Pharmacy queue content');
    expect(container.textContent).not.toContain('Administration');
    expect(testState.executiveHook).not.toHaveBeenCalled();
  });

  it.each([
    ['ADMINISTRATOR', [authPermission('Administration', 'Dashboard')], 'Administration dashboard content'],
    ['RECEPTIONIST', [authPermission('Appointments', 'Appointment Records')], 'Appointment dashboard content'],
    ['CLINICIAN_NURSE', [authPermission('OPD', 'OPD Visits')], 'OPD dashboard content'],
    ['LABORATORY_USER', [authPermission('Laboratory', 'Orders')], 'Laboratory queue content'],
    ['IMAGING_USER', [authPermission('Imaging', 'Orders')], 'Imaging queue content'],
    ['BILLING_AUTHORIZED', [authPermission('Billing', 'Invoices')], 'Billing dashboard content'],
  ])('selects the permitted operational default for %s', async (roleCode, permissions, expectedContent) => {
    testState.user = user(roleCode, permissions);
    await render();

    expect(container.textContent).toContain(expectedContent);
    expect(container.textContent).not.toContain('Hospital Executive Overview');
    expect(testState.executiveHook).not.toHaveBeenCalled();
  });

  it('requires the Billing User role as well as Billing view permission', async () => {
    testState.user = user('CUSTOM_FINANCE_VIEWER', [authPermission('Billing', 'Invoices')]);
    await render();

    expect(container.textContent).toContain('My Access');
    expect(container.textContent).not.toContain('Billing dashboard content');
  });

  it('does not show Billing to a Billing User without Billing view permission', async () => {
    testState.user = user('BILLING_AUTHORIZED', [authPermission('Patients', 'Patient Records')]);
    await render();

    expect(container.textContent).toContain('My Access');
    expect(container.textContent).not.toContain('Billing dashboard content');
  });

  it('uses a safe permission-based fallback for custom roles', async () => {
    testState.user = user('CUSTOM_PATIENT_RECORDS', [authPermission('Patients', 'Patient Records')]);
    await render();

    expect(container.textContent).toContain('My Access');
    expect(container.textContent).toContain('My HMS Workspace');
    expect(container.textContent).toContain('Patients');
    expect(testState.executiveHook).not.toHaveBeenCalled();
  });

  it('updates the dashboard immediately when the authenticated user changes', async () => {
    testState.user = user('DOCTOR', [
      authPermission('Doctors', 'Doctor Directory'),
      authPermission('Appointments', 'Appointment Records'),
    ]);
    await render();
    expect(container.textContent).toContain('Doctor dashboard content');

    testState.user = user('BILLING_AUTHORIZED', [authPermission('Billing', 'Invoices')]);
    await render();
    expect(container.textContent).toContain('Billing dashboard content');
    expect(container.textContent).not.toContain('Doctor dashboard content');
  });
});
