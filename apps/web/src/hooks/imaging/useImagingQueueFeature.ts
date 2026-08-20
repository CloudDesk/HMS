import { useCallback, useMemo } from 'react';
import type { DiagnosticListParams, DiagnosticOrder } from '../../api/laboratory';
import { useAuth } from '../../auth/useAuth';
import { useBranchesList } from '../branches/useBranches';
import { useImagingOrders, useImagingSummary } from './useImaging';
import { navigate, useAppLocation } from '../../routing/navigation';

export function useImagingQueueFeature() {
  const { user } = useAuth();
  const location = useAppLocation();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const superAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));

  const branchesQuery = useBranchesList({ status: 'ACTIVE', page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' }, superAdmin);
  const branches = useMemo(() => superAdmin
    ? (branchesQuery.data?.data ?? []).map(({ id, code, name }) => ({ id, code, name }))
    : (user?.branches ?? []), [branchesQuery.data?.data, superAdmin, user?.branches]);

  const selectedBranch = query.get('branch_id') ?? '';
  const search = query.get('search') ?? '';
  const status = query.get('status') ?? '';
  const priority = query.get('priority') ?? '';
  const dateFrom = query.get('date_from') ?? '';
  const dateTo = query.get('date_to') ?? '';
  const page = Math.max(1, Number(query.get('page') ?? 1) || 1);
  const limit = Math.min(100, Math.max(10, Number(query.get('limit') ?? 20) || 20));

  const updateFilters = useCallback((changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams(location.search);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === '' || value === null) next.delete(key);
      else next.set(key, String(value));
    });
    navigate(`/imaging/queue${next.size ? `?${next.toString()}` : ''}`, { replace: true });
  }, [location.search]);

  const clearFilters = useCallback(() => {
    navigate('/imaging/queue', { replace: true });
  }, []);

  const listParams = useMemo<DiagnosticListParams>(() => ({
    branch_id: selectedBranch || undefined,
    search: search.trim() || undefined,
    status: status || undefined,
    priority: priority as DiagnosticListParams['priority'] || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    page,
    limit,
  }), [dateFrom, dateTo, limit, page, priority, search, selectedBranch, status]);

  const hasAccess = superAdmin || Boolean(user?.permissions.some(p => p.module === 'IMAGING'));

  const listQuery = useImagingOrders(listParams, hasAccess);
  const summaryQuery = useImagingSummary(selectedBranch || undefined, hasAccess);

  return {
    branches,
    filters: { selectedBranch, search, status, priority, dateFrom, dateTo, page, limit },
    updateFilters,
    clearFilters,
    orders: (listQuery.data?.data ?? []) as DiagnosticOrder[],
    meta: listQuery.data?.meta ?? { page, limit, total: 0, totalPages: 1 },
    summary: summaryQuery.data ?? null,
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    isSummaryLoading: summaryQuery.isLoading,
  };
}
