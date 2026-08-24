import { useEffect, useState } from 'react';
import { hasPermission } from '../../auth/access-control';
import { useAuth } from '../../auth/useAuth';
import { useBranchesList } from '../branches/useBranches';
import { usePhaseTwoReports } from './usePhaseTwoReports';
export function usePhaseTwoReportsFeature() {
  const { user } = useAuth();
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
  const [branchId, setBranchId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    if (!branches.some((branch) => branch.id === branchId)) setBranchId(branches[0]?.id ?? '');
  }, [branchId, branches]);
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
