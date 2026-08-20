import { useMemo, useState } from 'react';
import { useAppLocation, navigate } from '../../routing/navigation';
import { useAuth } from '../../auth/useAuth';
import { useBillingCapabilities } from './useBillingFeature';
import { useBranchesList } from '../branches/useBranches';
import { usePatientsList } from '../patients/usePatients';
import { useBillingInvoices } from './useBilling';
import type { BillingInvoiceListParams, BillingInvoiceStatus } from '../../api/billing';

export function useBillingHistoryFeature() {
  const { user } = useAuth();
  const capabilities = useBillingCapabilities();
  const { isSuperAdmin } = capabilities;
  const location = useAppLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const invoiceNumber = params.get('invoice_number') ?? '';
  const patientId = params.get('patient_id') ?? '';
  const status = (params.get('status') ?? '') as BillingInvoiceStatus | '';
  const dateFrom = params.get('date_from') ?? '';
  const dateTo = params.get('date_to') ?? '';
  const branchId = params.get('branch_id') ?? '';

  const [invoiceInput, setInvoiceInput] = useState(invoiceNumber);

  const branchesQuery = useBranchesList(
    { status: 'ACTIVE', page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' },
    isSuperAdmin
  );

  const patientsQuery = usePatientsList(
    { status: 'ACTIVE', page: 1, limit: 100, sortBy: 'last_name', sortOrder: 'asc' }
  );

  const branches = useMemo(() => {
    return isSuperAdmin
      ? (branchesQuery.data?.data ?? []).map((branch) => ({ id: branch.id, name: branch.name }))
      : (user?.branches ?? []).map((branch) => ({ id: branch.id, name: branch.name }));
  }, [isSuperAdmin, branchesQuery.data?.data, user?.branches]);

  const queryParams: BillingInvoiceListParams = useMemo(() => ({
    invoice_number: invoiceNumber || undefined,
    patient_id: patientId || undefined,
    status: status || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    branch_id: branchId || undefined,
    page,
    limit: 20,
    sortBy: 'created_at',
    sortOrder: 'desc',
  }), [invoiceNumber, patientId, status, dateFrom, dateTo, branchId, page]);

  const invoicesQuery = useBillingInvoices(queryParams);
  const meta = invoicesQuery.data?.meta ?? { total: 0, page, limit: 20, totalPages: 1 };

  const updateFilters = (changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams(location.search);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null || value === '') next.delete(key); else next.set(key, String(value));
    });
    navigate(`/billing/history${next.toString() ? `?${next}` : ''}`, { replace: true });
  };

  const clearFilters = () => {
    setInvoiceInput('');
    navigate('/billing/history', { replace: true });
  };

  return {
    state: {
      page,
      invoiceNumber,
      patientId,
      status,
      dateFrom,
      dateTo,
      branchId,
      invoiceInput,
      meta,
    },
    capabilities,
    queries: {
      branches,
      branchesQuery,
      patientsQuery,
      invoicesQuery,
    },
    actions: {
      setInvoiceInput,
      updateFilters,
      clearFilters,
    },
  };
}

