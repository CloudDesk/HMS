export type DashboardMetric = {
  label: string;
  value: number;
};

export type DashboardActivity = {
  id: string;
  actorName: string;
  eventType: string;
  module: string;
  createdAt: Date;
};

export type AdministrationDashboardSnapshot = {
  generatedAt: Date;
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
