// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  navigate: vi.fn(),
  appointment: undefined as unknown,
  doctor: undefined as unknown,
  opd: undefined as unknown,
  billing: undefined as unknown,
}));

vi.mock('../routing/navigation', () => ({
  navigate: testState.navigate,
  useAppLocation: () => ({ pathname: '/dashboard', search: '' }),
}));
vi.mock('../api/useSettings', () => ({
  useTimezone: () => 'UTC',
  useCurrencyFormatter: () => (value: number) => `$${value}`,
}));
vi.mock('../hooks/appointments/useAppointmentDashboardFeature', () => ({
  useAppointmentDashboardFeature: () => testState.appointment,
}));
vi.mock('../hooks/doctors/useDoctorDashboard', () => ({
  useDoctorDashboard: () => testState.doctor,
}));
vi.mock('../hooks/opd/useOpdDashboard', () => ({
  useOpdDashboard: () => testState.opd,
}));
vi.mock('../hooks/billing/useBillingDashboardFeature', () => ({
  useBillingDashboardFeature: () => testState.billing,
}));

import { AppointmentDashboardPage } from './AppointmentDashboardPage';
import { BillingDashboardPage } from './BillingDashboardPage';
import { DoctorDashboardPage } from './DoctorDashboardPage';
import { OpdDashboardPage } from './OpdDashboardPage';

const noOp = vi.fn();
const idleQuery = {
  data: undefined,
  isError: false,
  isLoading: false,
  refetch: noOp,
};

describe('role-focused dashboard content', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    testState.navigate.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = async (component: ReactNode) => {
    await act(async () => root.render(component));
  };

  it('hides reception-only appointment actions for a view-only user', async () => {
    testState.appointment = {
      state: {
        search: '', statusFilter: '', dateFrom: '2026-09-03', dateTo: '2026-09-03',
        currentPage: 1, sortColumn: 'appointment_date', sortDirection: 'asc',
        meta: { page: 1, limit: 10, total: 0, totalPages: 1 }, appointments: [],
        loading: false, loadError: '', isUpdatingStatus: false,
      },
      capabilities: { canBook: false, canEditStatus: false, canSearchPatients: true, canViewQueue: true },
      actions: {
        setSearch: noOp, setStatusFilter: noOp, setDateFrom: noOp, setDateTo: noOp,
        setCurrentPage: noOp, handleSort: noOp, resetFilters: noOp,
        handleUpdateStatus: noOp, refetch: noOp,
      },
    };

    await render(<AppointmentDashboardPage />);

    expect(container.textContent).not.toContain('Book Appointment');
    expect(container.textContent).not.toContain('Walk-in Registration');
    expect(container.textContent).toContain('Search Patient');
    expect(container.querySelector('[title="Confirm appointment"]')).toBeNull();
    expect(container.querySelector('[title="Mark checked in"]')).toBeNull();
    expect(container.querySelector('[title="Cancel appointment"]')).toBeNull();
  });

  it('removes doctor placeholder metrics and routes clinical work through the OPD queue', async () => {
    testState.doctor = {
      doctors: [], selectedDoctor: null, selectedDoctorId: '', setSelectedDoctorId: noOp,
      todayAppointments: [], weekAppointments: [], hasCompleteAppointmentDataset: true,
      appointmentSummary: { total: 6, follow_ups: 2, urgent: 1, by_status: {} },
      opdSummary: { total: 4, urgent: 1, follow_ups: 1, walk_ins: 0, by_status: { READY_FOR_CONSULTATION: 2, IN_CONSULTATION: 1 } },
      isDoctorUser: true, canViewAppointments: true, canEditAppointments: false,
      canViewOpdQueue: true, canSearchPatients: true, isLoading: false, errorMessage: '',
    };

    await render(<DoctorDashboardPage />);

    expect(container.textContent).not.toContain('Completed Consultations');
    expect(container.textContent).not.toContain('Pending Reports');
    expect(container.textContent).not.toContain('Average Consultation Time');
    expect(container.textContent).toContain('Open Clinical Queue');
    expect(container.textContent).toContain('Patient Search');
    expect(container.textContent).toContain('Pending Clinical Work');
    expect(container.textContent).toContain('Urgent Cases');

    const patientSearch = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Patient Search'));
    await act(async () => patientSearch?.click());
    expect(testState.navigate).toHaveBeenCalledWith('/patients/search');
  });

  it('gates OPD quick actions independently', async () => {
    testState.opd = {
      visits: [], weekVisits: [], loading: false, loadError: null, trend: [],
      waitingVisits: [], readyVisits: [], inConsultationVisits: [], completedVisits: [], urgentVisits: [],
      hasCompleteDataset: true,
      branchScope: 'ALL_AUTHORIZED',
      summary: { total: 8, urgent: 2, follow_ups: 1, walk_ins: 3, by_status: { CHECKED_IN: 2, WAITING_FOR_VITALS: 1, READY_FOR_CONSULTATION: 2, IN_CONSULTATION: 1, COMPLETED: 2 } },
      summaryLoading: false,
      capabilities: { canCheckIn: false, canSearchPatients: true, canViewQueue: true },
    };

    await render(<OpdDashboardPage />);

    expect(container.textContent).toContain('Patients');
    expect(container.textContent).toContain('Open Queue');
    expect(container.textContent).not.toContain('Check-in Patient');
    expect(container.textContent).toContain('Awaiting Nursing Action');
    expect(container.textContent).toContain('Walk-ins');
  });

  it('does not render failed Billing summaries as zero values', async () => {
    testState.billing = {
      state: {
        effectiveBranchId: '',
        summary: {
          total_invoices: 0, billed_amount: 0, collected_amount: 0, outstanding_amount: 0,
          by_status: { DRAFT: 0, PENDING: 0, PARTIALLY_PAID: 0, PAID: 0, CANCELLED: 0 },
        },
      },
      capabilities: { canCreate: false },
      queries: {
        branches: [],
        summaryQuery: { ...idleQuery, isError: true },
        invoicesQuery: { ...idleQuery, data: { data: [], meta: { page: 1, limit: 8, total: 0, totalPages: 1 } } },
      },
      actions: { setSelectedBranchId: noOp },
    };

    await render(<BillingDashboardPage />);

    expect(container.textContent).toContain('Billing data could not be loaded.');
    expect(container.textContent).toContain('Summary unavailable');
    expect(container.querySelector('table')).toBeNull();
    expect(container.textContent).not.toContain('New Invoice');

    const totalInvoices = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Total Invoices'));
    await act(async () => totalInvoices?.click());
    expect(testState.navigate).toHaveBeenCalledWith('/dashboard?tab=billing', { replace: true });
    expect(testState.navigate).toHaveBeenCalledWith('/billing/history');
  });

  it('shows a precise non-zero Billing collection rate', async () => {
    testState.billing = {
      state: {
        effectiveBranchId: '',
        summary: {
          total_invoices: 25,
          billed_amount: 15101184.5,
          collected_amount: 16889,
          outstanding_amount: 15084295.5,
          by_status: { DRAFT: 5, PENDING: 9, PARTIALLY_PAID: 1, PAID: 8, CANCELLED: 2 },
        },
      },
      capabilities: { canCreate: false },
      queries: {
        branches: [],
        summaryQuery: idleQuery,
        invoicesQuery: { ...idleQuery, data: { data: [], meta: { page: 1, limit: 8, total: 0, totalPages: 1 } } },
      },
      actions: { setSelectedBranchId: noOp },
    };

    await render(<BillingDashboardPage />);

    expect(container.textContent).toContain('0.11%');
    expect(container.textContent).toContain('10 invoices awaiting settlement');
  });
});
