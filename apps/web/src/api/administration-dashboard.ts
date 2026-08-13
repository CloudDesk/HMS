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

export const administrationDashboardApi = {
  get() {
    return apiClient.request<AdministrationDashboard>('/administration/dashboard');
  },
};
