import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { useAdministrationDashboard } from './useAdministrationDashboard';
import { ApiError } from '../../api/api-error';
import { useMemo } from 'react';

export function useAdministrationDashboardFeature() {
  const { user } = useAuth();
  
  const isSuperAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const canView = isSuperAdmin || hasPermission(user?.permissions ?? [], {
    module: 'Administration',
    screen: 'Dashboard',
    action: 'View',
  });

  const query = useAdministrationDashboard(canView);
  
  const forbidden = !canView || (query.error instanceof ApiError && query.error.status === 403);
  
  const loadError = query.error
    ? forbidden
      ? 'You do not have permission to view the Administration Dashboard.'
      : query.error instanceof Error
        ? query.error.message
        : 'Administration statistics could not be loaded.'
    : '';

  const kpis = useMemo(() => query.data ? [
    { detail: `${query.data.kpis.activeUsers} active`, icon: 'ph-users-three', label: 'Total Users', tone: 'blue' as const, value: query.data.kpis.totalUsers },
    { detail: 'Configured access roles', icon: 'ph-shield-check', label: 'Roles', tone: 'purple' as const, value: query.data.kpis.totalRoles },
    { detail: 'Clinical and support units', icon: 'ph-buildings', label: 'Departments', tone: 'green' as const, value: query.data.kpis.totalDepartments },
    { detail: 'Available catalogue items', icon: 'ph-first-aid-kit', label: 'Services', tone: 'orange' as const, value: query.data.kpis.totalServices },
    { detail: 'Hospital locations', icon: 'ph-map-pin', label: 'Branches', tone: 'red' as const, value: query.data.kpis.totalBranches },
  ] : [], [query.data]);

  return {
    data: {
      dashboard: query.data,
      kpis,
    },
    status: {
      isFetching: query.isFetching,
      loadError,
      forbidden,
    },
    rbac: {
      canView,
    },
    actions: {
      refetch: query.refetch,
    }
  };
}
