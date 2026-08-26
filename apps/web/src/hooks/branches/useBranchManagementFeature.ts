import { useState, useCallback } from 'react';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import type { ApiBranchStatus, BranchListResponse, BranchSummary } from '../../api/branches';
import {
  useBranchesList,
  useBranchSummary,
  useCreateBranch,
  useUpdateBranch,
  useUpdateBranchStatus,
  useDeleteBranch,
  useExportBranches
} from './useBranches';
import { ApiError } from '../../api/api-error';

export type SortColumn = 'code' | 'name' | 'created_at';
export type SortDirection = 'asc' | 'desc';

export function useBranchManagementFeature() {
  const { user } = useAuth();
  
  const isSuperAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const can = useCallback((action: string) => isSuperAdmin || hasPermission(user?.permissions ?? [], {
    module: 'Administration', screen: 'Branches', action,
  }), [isSuperAdmin, user?.permissions]);

  const canView = can('View');
  const canCreate = can('Create');
  const canEdit = can('Edit');
  const canDelete = can('Delete');
  const canExport = can('Export');
  const canConfigureWards = isSuperAdmin || (
    hasPermission(user?.permissions ?? [], { module: 'Admissions', screen: 'Wards', action: 'View' })
    && hasPermission(user?.permissions ?? [], { module: 'Admissions', screen: 'Wards', action: 'Create' })
  );
  const canConfigureBeds = isSuperAdmin || (
    hasPermission(user?.permissions ?? [], { module: 'Admissions', screen: 'Beds', action: 'View' })
    && hasPermission(user?.permissions ?? [], { module: 'Admissions', screen: 'Beds', action: 'Create' })
  );

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApiBranchStatus | ''>('');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const listParams = {
    search: query.trim() || undefined,
    status: (statusFilter as ApiBranchStatus) || undefined,
    page: currentPage,
    limit: pageSize,
    sortBy: sortColumn || undefined,
    sortOrder: sortColumn ? sortDirection : undefined,
  };

  const branchesQuery = useBranchesList(listParams, canView);
  const summaryQuery = useBranchSummary(canView);

  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const updateBranchStatus = useUpdateBranchStatus();
  const deleteBranch = useDeleteBranch();
  const exportBranches = useExportBranches();

  const handleSort = useCallback((column: SortColumn) => {
    setSortColumn((current) => {
      if (current === column) {
        setSortDirection((dir) => (dir === 'asc' ? 'desc' : 'asc'));
        return current;
      }
      setSortDirection('asc');
      return column;
    });
    setCurrentPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setQuery('');
    setStatusFilter('');
    setCurrentPage(1);
  }, []);

  const handleExport = useCallback(async () => {
    if (!canExport) return;
    try {
      const blob = await exportBranches.mutateAsync(listParams);
      // Let the page handle the blob download, or if exportBranches handles it, that's fine.
      return blob;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }, [canExport, exportBranches, listParams]);

  const isFetching = branchesQuery.isFetching || summaryQuery.isFetching;
  const isMutating = createBranch.isPending || updateBranch.isPending || updateBranchStatus.isPending || deleteBranch.isPending || exportBranches.isPending;
  const error = branchesQuery.error || summaryQuery.error;
  const loadError = error ? (error as Error).message || 'Unable to load branches.' : '';
  const forbidden = error instanceof ApiError && error.status === 403;

  const emptyMeta: BranchListResponse['meta'] = { limit: pageSize, page: currentPage, total: 0, totalPages: 1 };
  const emptySummary: BranchSummary = { total: 0, active: 0, inactive: 0, assignedUsers: 0, cities: 0 };

  return {
    state: {
      query,
      statusFilter,
      sortColumn,
      sortDirection,
      currentPage,
      pageSize,
      setQuery,
      setStatusFilter,
      setCurrentPage,
      setPageSize,
    },
    data: {
      branches: branchesQuery.data?.data || [],
      meta: branchesQuery.data?.meta || emptyMeta,
      summary: summaryQuery.data || emptySummary,
    },
    status: {
      isFetching,
      isMutating,
      loadError,
      forbidden,
    },
    rbac: {
      canView,
      canCreate,
      canEdit,
      canDelete,
      canExport,
      canConfigureWards,
      canConfigureBeds,
    },
    actions: {
      handleSort,
      resetFilters,
      handleExport,
    },
    mutations: {
      createBranch,
      updateBranch,
      updateBranchStatus,
      deleteBranch,
    },
  };
}
