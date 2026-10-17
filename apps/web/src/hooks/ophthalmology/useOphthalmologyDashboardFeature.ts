import { toast } from 'sonner';
import { hasPermission } from '../../auth/access-control';
import { useAuth } from '../../auth/useAuth';
import { ophthalmologyDashboardQuerySchema } from '../../api/ophthalmology-dashboard';
import { useActiveBranch } from '../../context/BranchContext';
import { navigate, useAppLocation } from '../../routing/navigation';
import { getOpdErrorMessage } from '../../pages/opd-utils';
import { useBranchesList } from '../branches/useBranches';
import { useOphthalmologyDashboard } from './useOphthalmologyDashboard';

export function useOphthalmologyDashboardFeature() {
  const { user } = useAuth();
  const { activeBranchId } = useActiveBranch();
  const { search } = useAppLocation();
  const params = new URLSearchParams(search);
  const permitted = (module: string, screen: string, action = 'View') =>
    Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'))
      || hasPermission(user?.permissions ?? [], { module, screen, action });
  const canView = permitted('OPD', 'Ophthalmology Reports');
  const canRefresh = canView && permitted('OPD', 'Ophthalmology Reports', 'Export');
  const branchId = params.get('branch_id') ?? activeBranchId ?? '';
  const parsed = ophthalmologyDashboardQuerySchema.safeParse({ branch_id: branchId });
  const query = parsed.success ? parsed.data : null;
  const dashboard = useOphthalmologyDashboard(query, canView);
  const canReadBranches = canView && permitted('Administration', 'Branches') && !user?.branches.length;
  const branchesQuery = useBranchesList({ status: 'ACTIVE', page: 1, limit: 100 }, canReadBranches);
  const branches = user?.branches.length
    ? user.branches
    : canReadBranches ? branchesQuery.data?.data ?? [] : [];
  const snapshot = canView && query ? dashboard.snapshot.data : undefined;
  const total = snapshot ? Object.values(snapshot.metrics).reduce((sum, value) => sum + value, 0) : null;
  const setBranch = (value: string) => {
    if (!canView) return;
    const next = new URLSearchParams(search);
    if (value) next.set('branch_id', value); else next.delete('branch_id');
    navigate(`/opd/ophthalmology/dashboard${next.size ? `?${next}` : ''}`);
  };
  const refresh = async () => {
    if (!canRefresh || !query || dashboard.refresh.isPending) return;
    try {
      await dashboard.refresh.mutateAsync();
      toast.success('Ophthalmology dashboard snapshot refreshed.');
    } catch (error: unknown) {
      toast.error(getOpdErrorMessage(error));
    }
  };
  return {
    canView,
    canRefresh,
    canReadBranches,
    branchId,
    query,
    invalid: parsed.success ? null : 'Select a valid branch.',
    branches,
    branchesQuery,
    snapshot,
    total,
    snapshotQuery: dashboard.snapshot,
    refreshMutation: dashboard.refresh,
    error: dashboard.snapshot.isError ? getOpdErrorMessage(dashboard.snapshot.error) : null,
    setBranch,
    refresh,
  };
}

export type OphthalmologyDashboardFeature = ReturnType<typeof useOphthalmologyDashboardFeature>;
