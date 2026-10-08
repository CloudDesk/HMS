import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { administrationDashboardApi } from '../../api/administration-dashboard';
import { hasPermission } from '../../auth/access-control';
import { useAuth } from '../../auth/useAuth';

export function useDashboardOverviewFeature(
  range: 'week' | 'month' | 'year' = 'week',
  scheduleDate?: string,
) {
  const { user } = useAuth();
  const [selectedBranchId, setSelectedBranchId] = useState<string | undefined>(undefined);

  const canViewDashboard = hasPermission(
    user?.permissions ?? [],
    { module: 'Administration', screen: 'Dashboard', action: 'View' },
  );

  const query = useQuery({
    queryKey: ['executive-dashboard-overview', selectedBranchId, range, scheduleDate],
    queryFn: () => administrationDashboardApi.getOverview(selectedBranchId, range, scheduleDate),
    enabled: Boolean(user) && canViewDashboard,
    staleTime: 30_000,
  });

  const defaultData = {
    generatedAt: new Date().toISOString(),
    branchId: null,
    kpis: {
      registeredPatients: 0,
      activeDoctors: 0,
      todayAppointments: 0,
      todayOpdVisits: 0,
      todayBilledRevenue: null,
    },
    financialSummary: null,
    trend: [],
    recentVisits: [],
    scheduleItems: [],
    operationalMetrics: {
      patientsWaiting: 0,
      patientsInConsultation: 0,
      completedConsultationsToday: 0,
    },
  };

  return {
    data: query.data ?? defaultData,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    hasData: Boolean(query.data),
    selectedBranchId,
    setSelectedBranchId,
    refresh: () => query.refetch(),
  };
}
