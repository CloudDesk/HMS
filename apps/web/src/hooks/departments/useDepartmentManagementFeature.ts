import { useState, useCallback } from 'react';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import type { ApiDepartmentStatus, DepartmentListResponse, DepartmentSummary } from '../../api/departments';
import {
  useDepartmentsList,
  useDepartmentSummary,
  useCreateDepartment,
  useUpdateDepartment,
  useUpdateDepartmentStatus,
  useDeleteDepartment,
  useExportDepartments,
  useDepartmentDeletePreview,
} from './useDepartments';
import { useBulkDeleteServices, useDeleteService } from '../services/useServices';
import { useReassignDepartmentUsers } from '../users/useUsers';
import { useBranchesList } from '../branches/useBranches';
import { ApiError } from '../../api/api-error';

export type SortColumn = 'code' | 'name' | 'created_at';
export type SortDirection = 'asc' | 'desc';

export function useDepartmentManagementFeature() {
  const { user } = useAuth();
  
  const isSuperAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const can = useCallback((action: string) => isSuperAdmin || hasPermission(user?.permissions ?? [], {
    module: 'Administration', screen: 'Departments', action,
  }), [isSuperAdmin, user?.permissions]);

  const canView = can('View');
  const canCreate = can('Create');
  const canEdit = can('Edit');
  const canDelete = can('Delete');
  const canExport = can('Export');

  const [query, setQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApiDepartmentStatus | ''>('');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const listParams = {
    search: query.trim() || undefined,
    branch_id: branchFilter || undefined,
    status: (statusFilter as ApiDepartmentStatus) || undefined,
    page: currentPage,
    limit: pageSize,
    sortBy: sortColumn || undefined,
    sortOrder: sortColumn ? sortDirection : undefined,
  };

  const departmentsQuery = useDepartmentsList(listParams, canView);
  const summaryQuery = useDepartmentSummary(canView);
  const branchesQuery = useBranchesList({ limit: 100, status: 'ACTIVE' }, canView); // fetch branch names

  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const updateDepartmentStatus = useUpdateDepartmentStatus();
  const deleteDepartment = useDeleteDepartment();
  const exportDepartments = useExportDepartments();

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
    setBranchFilter('');
    setStatusFilter('');
    setCurrentPage(1);
  }, []);

  const handleExport = useCallback(async () => {
    if (!canExport) return;
    try {
      const blob = await exportDepartments.mutateAsync(listParams);
      return blob;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }, [canExport, exportDepartments, listParams]);

  const isFetching = departmentsQuery.isFetching || summaryQuery.isFetching || branchesQuery.isFetching;
  const isMutating = createDepartment.isPending || updateDepartment.isPending || updateDepartmentStatus.isPending || deleteDepartment.isPending || exportDepartments.isPending;
  const error = departmentsQuery.error || summaryQuery.error || branchesQuery.error;
  const loadError = error ? (error as Error).message || 'Unable to load departments.' : '';
  const forbidden = error instanceof ApiError && error.status === 403;

  const emptyMeta: DepartmentListResponse['meta'] = { limit: pageSize, page: currentPage, total: 0, totalPages: 1 };
  const emptySummary: DepartmentSummary = { total: 0, active: 0, inactive: 0, addedThisMonth: 0, branchesCovered: 0 };

  return {
    state: {
      query,
      branchFilter,
      statusFilter,
      sortColumn,
      sortDirection,
      currentPage,
      pageSize,
      setQuery,
      setBranchFilter,
      setStatusFilter,
      setCurrentPage,
      setPageSize,
    },
    data: {
      departments: departmentsQuery.data?.data || [],
      meta: departmentsQuery.data?.meta || emptyMeta,
      summary: summaryQuery.data || emptySummary,
      branches: branchesQuery.data?.data || [],
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
    },
    actions: {
      handleSort,
      resetFilters,
      handleExport,
    },
    mutations: {
      createDepartment,
      updateDepartment,
      updateDepartmentStatus,
      deleteDepartment,
    },
  };
}

export function useDepartmentDeletePreviewFeature(id: string, page: number, limit = 100) {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const canDelete = isSuperAdmin || hasPermission(user?.permissions ?? [], {
    module: 'Administration', screen: 'Departments', action: 'Delete',
  });
  const query = useDepartmentDeletePreview(id, page, canDelete, limit);
  const deleteService = useDeleteService();
  const bulkDeleteServices = useBulkDeleteServices();
  const reassignUsers = useReassignDepartmentUsers();
  const canDeleteService = isSuperAdmin || hasPermission(user?.permissions ?? [], {
    module: 'Administration', screen: 'Services', action: 'Delete',
  });
  const canReassignUsers = isSuperAdmin || hasPermission(user?.permissions ?? [], {
    module: 'Administration', screen: 'Users', action: 'Edit',
  });
  const canViewDepartments = isSuperAdmin || hasPermission(user?.permissions ?? [], {
    module: 'Administration', screen: 'Departments', action: 'View',
  });
  const targetDepartmentsQuery = useDepartmentsList(
    { status: 'ACTIVE', page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' },
    canReassignUsers && canViewDepartments && Boolean(query.data?.user_meta.total),
  );
  return {
    data: query.data,
    loading: query.isLoading,
    error: query.error,
    retry: query.refetch,
    deleteService,
    bulkDeleteServices,
    canDeleteService,
    reassignUsers,
    canReassignUsers: canReassignUsers && canViewDepartments,
    targetDepartments: targetDepartmentsQuery.data?.data ?? [],
    targetDepartmentsLoading: targetDepartmentsQuery.isLoading,
    targetDepartmentsError: targetDepartmentsQuery.error,
    retryTargetDepartments: targetDepartmentsQuery.refetch,
  };
}
