import { apiClient } from './client';

export type DashboardMetric = { label: string; value: number };

export type DashboardActivity = {
  id: string;
  actorName: string;
  eventType: string;
  module: string;
  createdAt: string;
};

export type AdministrationDashboard = {
  generatedAt: string;
  kpis: {
    totalUsers: number;
    activeUsers: number;
    totalRoles: number;
    totalDepartments: number;
    totalServices: number;
    totalBranches: number;
  };
  usersByStatus: DashboardMetric[];
  usersByRole: DashboardMetric[];
  servicesByDepartment: DashboardMetric[];
  recentActivity: DashboardActivity[];
};

export type ExecutiveDashboardOverview = {
  generatedAt: string;
  branchId: string | null;
  kpis: {
    registeredPatients: number;
    activeDoctors: number;
    todayAppointments: number;
    todayOpdVisits: number;
    todayBilledRevenue: number | null;
  };
  financialSummary: {
    totalBilledAmount: number | null;
    collectedFunds: number | null;
    pendingOutstanding: number | null;
  } | null;
  trend: Array<{
    date: string;
    day: string;
    revenue: number;
    encounters: number;
  }>;
  recentVisits: Array<{
    id: string;
    visit_number: string;
    patient_name: string;
    doctor_name: string;
    check_in_time: string;
    status: string;
  }>;
  operationalMetrics: {
    patientsWaiting: number;
    patientsInConsultation: number;
    completedConsultationsToday: number;
  };
};

export const administrationDashboardApi = {
  get() {
    return apiClient.request<AdministrationDashboard>('/administration/dashboard');
  },
  getOverview(branchId?: string) {
    const query = branchId ? `?branch_id=${encodeURIComponent(branchId)}` : '';
    return apiClient.request<ExecutiveDashboardOverview>(`/administration/dashboard/overview${query}`);
  },
};
