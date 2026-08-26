import { useEffect, useState } from 'react';
import { hasPermission } from '../../auth/access-control';
import { useAuth } from '../../auth/useAuth';
import { navigate, useAppLocation } from '../../routing/navigation';
import { useBranchesList } from '../branches/useBranches';
import { usePhaseTwoReports } from './usePhaseTwoReports';
export function usePhaseTwoReportsFeature() {
  const { user } = useAuth();
  const { search } = useAppLocation();
  const initial = new URLSearchParams(search);
  const superAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const canView =
    superAdmin ||
    hasPermission(user?.permissions ?? [], {
      module: 'Reports',
      screen: 'Phase 2 Reports',
      action: 'View',
    });
  const branchesQuery = useBranchesList(
    { status: 'ACTIVE', limit: 100, sortBy: 'name', sortOrder: 'asc' },
    superAdmin,
  );
  const branches = superAdmin ? (branchesQuery.data?.data ?? []) : (user?.branches ?? []);
  const [branchId, setBranchId] = useState(initial.get('branch_id') ?? '');
  const [dateFrom, setDateFrom] = useState(initial.get('date_from') ?? '');
  const [dateTo, setDateTo] = useState(initial.get('date_to') ?? '');
  const [page, setPage] = useState(() => Math.max(1, Number(initial.get('page') ?? 1) || 1));
  useEffect(() => {
    if (!branches.some((branch) => branch.id === branchId)) setBranchId(branches[0]?.id ?? '');
  }, [branchId, branches]);
  useEffect(() => {
    const params = new URLSearchParams();
    if (branchId) params.set('branch_id', branchId);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    if (page > 1) params.set('page', String(page));
    navigate(`/reports/library${params.size ? `?${params.toString()}` : ''}`, { replace: true });
  }, [branchId, dateFrom, dateTo, page]);
  const query = usePhaseTwoReports(
    {
      branch_id: branchId,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page,
      limit: 25,
    },
    canView && Boolean(branchId),
  );
  return {
    state: {
      canView,
      branches,
      branchId,
      dateFrom,
      dateTo,
      page,
      data: query.data,
      loading: branchesQuery.isLoading || query.isLoading,
      fetching: query.isFetching,
      error: query.error instanceof Error ? query.error.message : '',
    },
    actions: { setBranchId, setDateFrom, setDateTo, setPage, refresh: query.refetch },
  };
}
