import { useState, useCallback } from 'react';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import type { ApiServiceStatus, ApiServiceType, ServiceListResponse, ServiceSummary } from '../../api/services';
import {
  useServicesList,
  useServiceSummary,
  useCreateService,
  useUpdateService,
  useUpdateServiceStatus,
  useDeleteService,
  useExportServices
} from './useServices';
import { useBranchesList } from '../branches/useBranches';
import { useDepartmentsList } from '../departments/useDepartments';
import { ApiError } from '../../api/api-error';

export type SortColumn = 'code' | 'name' | 'standard_price' | 'created_at';
export type SortDirection = 'asc' | 'desc';

export function useServiceCatalogueFeature() {
  const { user } = useAuth();
  
  const isSuperAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const can = useCallback((action: string) => isSuperAdmin || hasPermission(user?.permissions ?? [], {
    module: 'Administration', screen: 'Services', action,
  }), [isSuperAdmin, user?.permissions]);

  const canView = can('View');
  const canCreate = can('Create');
  const canEdit = can('Edit');
  const canDelete = can('Delete');
  const canExport = can('Export');

  const [query, setQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApiServiceStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<ApiServiceType | ''>('');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const listParams = {
    search: query.trim() || undefined,
    department_id: deptFilter || undefined,
    status: (statusFilter as ApiServiceStatus) || undefined,
    service_type: (typeFilter as ApiServiceType) || undefined,
    page: currentPage,
    limit: pageSize,
    sortBy: sortColumn || undefined,
    sortOrder: sortColumn ? sortDirection : undefined,
  };

  const servicesQuery = useServicesList(listParams, canView);
  const summaryQuery = useServiceSummary(canView);
  const branchesQuery = useBranchesList({ limit: 100, sortBy: 'name', sortOrder: 'asc' }, canView);
  const departmentsQuery = useDepartmentsList({ limit: 100, sortBy: 'name', sortOrder: 'asc' }, canView);

  const createService = useCreateService();
  const updateService = useUpdateService();
  const updateServiceStatus = useUpdateServiceStatus();
  const deleteService = useDeleteService();
  const exportServices = useExportServices();

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
    setDeptFilter('');
    setStatusFilter('');
    setTypeFilter('');
    setCurrentPage(1);
  }, []);

  const handleExport = useCallback(async () => {
    if (!canExport) return;
    try {
      const blob = await exportServices.mutateAsync(listParams);
      return blob;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }, [canExport, exportServices, listParams]);

  const isFetching = servicesQuery.isFetching || summaryQuery.isFetching || branchesQuery.isFetching || departmentsQuery.isFetching;
  const isMutating = createService.isPending || updateService.isPending || updateServiceStatus.isPending || deleteService.isPending || exportServices.isPending;
  const error = servicesQuery.error || summaryQuery.error || branchesQuery.error || departmentsQuery.error;
  const loadError = error ? (error as Error).message || 'Unable to load services.' : '';
  const forbidden = error instanceof ApiError && error.status === 403;

  const emptyMeta: ServiceListResponse['meta'] = { limit: pageSize, page: currentPage, total: 0, totalPages: 1 };
  const emptySummary: ServiceSummary = { total: 0, active: 0, inactive: 0, addedThisMonth: 0, departmentsCovered: 0, byType: { GENERAL: 0, LAB_TEST: 0, IMAGING_SERVICE: 0 } };

  return {
    state: {
      query,
      deptFilter,
      statusFilter,
      typeFilter,
      sortColumn,
      sortDirection,
      currentPage,
      pageSize,
      setQuery,
      setDeptFilter,
      setStatusFilter,
      setTypeFilter,
      setCurrentPage,
      setPageSize,
    },
    data: {
      services: servicesQuery.data?.data || [],
      meta: servicesQuery.data?.meta || emptyMeta,
      summary: summaryQuery.data || emptySummary,
      branches: branchesQuery.data?.data || [],
      departments: departmentsQuery.data?.data || [],
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
      createService,
      updateService,
      updateServiceStatus,
      deleteService,
    },
  };
}
