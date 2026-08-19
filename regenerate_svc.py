import re

with open('apps/web/src/pages/ServiceCataloguePage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace Imports
text = text.replace("import { useCallback, useEffect, useMemo, useState } from 'react';", "import { useEffect, useMemo, useState } from 'react';")
text = re.sub(r"import \{ useCreateService, useUpdateService, useUpdateServiceStatus, useDeleteService \} from '\.\./hooks/services/useServices';\n", "", text)
text = text.replace("import { useAuth } from '../auth/useAuth';", "import { useServiceCatalogueFeature, type SortColumn, type SortDirection } from '../hooks/services/useServiceCatalogueFeature';")
text = text.replace("import { hasPermission } from '../auth/access-control';\n", "")
text = re.sub(r"type SortColumn = 'code' \| 'name' \| 'standard_price' \| 'created_at';\ntype SortDirection = 'asc' \| 'desc';\n", "", text)
text = re.sub(r"import \{ branchesApi, type BranchResponse \} from '\.\./api/branches';\n", "import { type BranchResponse } from '../api/branches';\n", text)
text = re.sub(r"import \{ departmentsApi, type DepartmentResponse \} from '\.\./api/departments';\n", "import { type DepartmentResponse } from '../api/departments';\n", text)
text = text.replace("  servicesApi,\n", "")
text = text.replace("  type ServiceListResponse,\n", "")
text = text.replace("  type ServiceSummary,\n", "")

start_str = "export function ServiceCataloguePage() {"
end_str = "  return (\n    <>\n      <div className=\"um-grid\">"
start_idx = text.find(start_str)
end_idx = text.find(end_str)

new_body = """export function ServiceCataloguePage() {
  const formatPrice = useCurrencyFormatter();
  const feature = useServiceCatalogueFeature();
  const { state, data, status, rbac, actions, mutations } = feature;
  const { query, deptFilter, statusFilter, typeFilter, sortColumn, sortDirection, currentPage, pageSize, setQuery, setDeptFilter, setStatusFilter, setTypeFilter, setCurrentPage, setPageSize } = state;
  const { services, meta, summary, branches, departments } = data;
  const { isFetching: loading, isMutating: submitting, loadError } = status;
  const { canCreate, canEdit, canDelete, canExport } = rbac;
  const { handleSort, resetFilters, handleExport } = actions;

  const search = query;
  const setSearch = setQuery;
  const { search: locationSearch } = useAppLocation();

  // Modals
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [activeSvc, setActiveSvc] = useState<ServiceResponse | null>(null);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ServiceResponse | null>(null);

  const svcForm = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      code: '', name: '', service_type: 'GENERAL', branch_id: '',
      department_id: '', category: '', description: '', standard_price: '', status: 'ACTIVE'
    }
  });

  const watchedBranchId = svcForm.watch('branch_id');

  // Status
  const [toastMessage, setToastMessage] = useState('');
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastTone(tone);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };

  const formDepartmentOptions = useMemo(
    () => (watchedBranchId ? departments.filter((department) => department.branch_id === watchedBranchId) : departments),
    [departments, watchedBranchId],
  );

  const openModal = (mode: ModalMode, svc: ServiceResponse | null = null) => {
    setModalMode(mode);
    setActiveSvc(svc);
    setFormError('');
    if (svc) {
      const dept = departments.find((d) => d.id === svc.department_id);
      svcForm.reset({
        code: svc.code,
        name: svc.name,
        service_type: svc.service_type,
        branch_id: dept?.branch_id || '',
        department_id: svc.department_id,
        category: svc.category || '',
        description: svc.description || '',
        standard_price: svc.standard_price !== null ? String(svc.standard_price) : '',
        status: svc.status,
      });
    } else {
      svcForm.reset({
        code: '', name: '', service_type: 'GENERAL', branch_id: '',
        department_id: '', category: '', description: '', standard_price: '', status: 'ACTIVE'
      });
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setModalMode(null);
    setActiveSvc(null);
    setFormError('');
    svcForm.reset();
  };

  useEffect(() => {
    if (new URLSearchParams(locationSearch).get('action') === 'create' && !modalMode && canCreate) {
      openModal('create');
    }
  }, [locationSearch, canCreate, modalMode]);

  const handleSave = svcForm.handleSubmit(async (values) => {
    setFormError('');
    try {
      const payload = {
        code: values.code.trim(),
        name: values.name.trim(),
        service_type: values.service_type,
        department_id: values.department_id,
        category: values.category?.trim() || null,
        description: values.description?.trim() || null,
        standard_price: values.standard_price ? Number(values.standard_price) : null,
        status: values.status,
      };

      if (modalMode === 'create') {
        await mutations.createService.mutateAsync(payload);
        showToast('Service created successfully.');
      } else if (activeSvc) {
        await mutations.updateService.mutateAsync({ id: activeSvc.id, payload });
        showToast('Service updated successfully.');
      }
      closeModal();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await mutations.deleteService.mutateAsync(deleteTarget.id);
      showToast(`${deleteTarget.name} deleted successfully.`);
      setDeleteTarget(null);
      if (services.length === 1 && currentPage > 1) {
        setCurrentPage((page) => page - 1);
      }
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const updateStatus = async (service: ServiceResponse) => {
    try {
      const next: ApiServiceStatus = service.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await mutations.updateServiceStatus.mutateAsync({ id: service.id, status: next });
      showToast(`${service.name} ${next === 'ACTIVE' ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const exportServices = async () => {
    try {
      const blob = await handleExport();
      if (blob) {
        downloadBlob(blob, 'hms-services.csv');
        showToast('All filtered services exported.');
      }
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const totalPages = Math.max(meta.totalPages, 1);
  const safePage = Math.min(currentPage, totalPages);

  const getDepartmentName = (id: string) => departments.find((d) => d.id === id)?.name || id;

  const showingLabel =
    loadError || services.length === 0
      ? 'No services found'
      : `Showing ${(safePage - 1) * pageSize + 1}–${(safePage - 1) * pageSize + services.length} of ${meta.total} services`;

  const modalTitle =
    modalMode === 'create'
      ? 'Add New Service'
      : modalMode === 'edit' && activeSvc
        ? `Edit ${activeSvc.name}`
        : activeSvc
          ? `${activeSvc.name} Details`
          : 'Service';

"""

text = text[:start_idx] + new_body + text[end_idx:]

# Fix bottom elements that rely on manual vars
text = text.replace("disabled={forbidden || !hasExportPermission || submitting}", "disabled={status.forbidden || !canExport || submitting}")
text = text.replace("disabled={forbidden || !hasCreatePermission || submitting}", "disabled={status.forbidden || !canCreate || submitting}")
text = text.replace('onClick={() => void loadServices()}', 'onClick={() => void resetFilters()} /* Refresh */')
text = text.replace('onClick={loadServices}', 'onClick={() => void resetFilters()}')
text = text.replace('onClick={() => void exportServices()}', 'onClick={() => void exportServices()}')
text = text.replace('disabled={!hasCreatePermission}', 'disabled={!canCreate}')
text = text.replace('disabled={!hasExportPermission}', 'disabled={!canExport}')
text = text.replace('{hasEditPermission && (', '{canEdit && (')
text = text.replace('{hasDeletePermission && (', '{canDelete && (')

# Remove unused vars from bottom part (if they exist)
text = text.replace("const hasCreatePermission = isSuperAdmin || hasPermission(userPermissions, { module: 'Administration', screen: 'Services', action: 'Create' });", "")
text = text.replace("const hasEditPermission = isSuperAdmin || hasPermission(userPermissions, { module: 'Administration', screen: 'Services', action: 'Edit' });", "")
text = text.replace("const hasDeletePermission = isSuperAdmin || hasPermission(userPermissions, { module: 'Administration', screen: 'Services', action: 'Delete' });", "")
text = text.replace("const hasExportPermission = isSuperAdmin || hasPermission(userPermissions, { module: 'Administration', screen: 'Services', action: 'Export' });", "")
text = text.replace("const userPermissions = user?.permissions || [];", "")

with open('apps/web/src/pages/ServiceCataloguePage.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("done")
