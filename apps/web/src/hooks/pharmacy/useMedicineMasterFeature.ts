import { useCallback, useMemo } from 'react';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { useAppLocation, navigate } from '../../routing/navigation';
import {
  type ApiMedicineStatus,
  type MedicineListParams,
} from '../../api/medicines';
import {
  useMedicinesList,
  useMedicinesSummary,
  useExportMedicines,
  useSaveMedicine,
  useUpdateMedicineStatus,
  useDeleteMedicine,
} from '../medicines/useMedicines';

export function useMedicineMasterFeature() {
  const { user } = useAuth();
  const location = useAppLocation();

  const isSuperAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const can = (action: string) => isSuperAdmin || hasPermission(user?.permissions ?? [], {
    module: 'Administration', screen: 'Medicines', action,
  });

  const canCreate = can('Create');
  const canEdit = can('Edit');
  const canDelete = can('Delete');
  const canExport = can('Export');

  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const search = query.get('search') ?? '';
  const status = (query.get('status') ?? '') as ApiMedicineStatus | '';
  const dosageForm = query.get('dosage_form') ?? '';
  const page = Math.max(1, Number(query.get('page') ?? 1) || 1);
  const limit = Math.min(100, Math.max(5, Number(query.get('limit') ?? 10) || 10));
  const sortBy = (query.get('sortBy') ?? 'created_at') as NonNullable<MedicineListParams['sortBy']>;
  const sortOrder = (query.get('sortOrder') ?? 'desc') as 'asc' | 'desc';
  const queryAction = query.get('action');

  const updateQuery = useCallback((updates: Record<string, string | number | null>) => {
    const next = new URLSearchParams(location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, String(value));
    }
    const suffix = next.toString();
    navigate('/administration/medicines' + (suffix ? '?' + suffix : ''), { replace: true });
  }, [location.search]);

  const listParams = useMemo<MedicineListParams>(() => ({
    search: search.trim() || undefined,
    status: status || undefined,
    dosage_form: dosageForm.trim() || undefined,
    page,
    limit,
    sortBy,
    sortOrder,
  }), [dosageForm, limit, page, search, sortBy, sortOrder, status]);

  const listQuery = useMedicinesList(listParams);
  const summaryQuery = useMedicinesSummary();
  const { exportMedicines, isExporting: exporting } = useExportMedicines();
  const saveMutation = useSaveMedicine();
  const statusMutation = useUpdateMedicineStatus();
  const deleteMutation = useDeleteMedicine();

  return {
    permissions: {
      canCreate,
      canEdit,
      canDelete,
      canExport,
    },
    state: {
      search,
      status,
      dosageForm,
      page,
      limit,
      sortBy,
      sortOrder,
      queryAction,
    },
    actions: {
      updateQuery,
      handleExport: (downloadFn: (blob: Blob, name: string) => void) => exportMedicines(listParams, downloadFn),
    },
    queries: {
      listQuery,
      summaryQuery,
    },
    mutations: {
      saveMutation,
      statusMutation,
      deleteMutation,
    },
    flags: {
      exporting,
    },
  };
}


