import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useAppLocation } from '../../routing/navigation';
import { useBillingCapabilities } from './useBillingFeature';
import { useBranchesList } from '../branches/useBranches';
import { useBillingInvoices, useBillingSummary } from './useBilling';

export function useBillingDashboardFeature({ includeRecent = true }: { includeRecent?: boolean } = {}) {
  const { user } = useAuth();
  const capabilities = useBillingCapabilities();
  const { isSuperAdmin } = capabilities;
  const location = useAppLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  
  const branchesQuery = useBranchesList(
    { status: 'ACTIVE', page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' },
    isSuperAdmin
  );
  
  const branches = useMemo(() => {
    return isSuperAdmin
      ? (branchesQuery.data?.data ?? []).map((branch) => ({ id: branch.id, name: branch.name }))
      : (user?.branches ?? []).map((branch) => ({ id: branch.id, name: branch.name }));
  }, [isSuperAdmin, branchesQuery.data?.data, user?.branches]);

  const requestedBranch = params.get('branch_id') ?? '';
  const branchId = branches.some((branch) => branch.id === requestedBranch) ? requestedBranch : '';

  const [selectedBranchId, setSelectedBranchId] = useState(branchId);
  const effectiveBranchId = selectedBranchId || branchId;

  const summaryQuery = useBillingSummary({ branch_id: effectiveBranchId || undefined });
  
  const invoicesQuery = useBillingInvoices({ 
    branch_id: effectiveBranchId || undefined, 
    page: 1, 
    limit: 8, 
    sortBy: 'created_at', 
    sortOrder: 'desc' 
  }, includeRecent);

  const summary = summaryQuery.data ?? {
    total_invoices: 0,
    billed_amount: 0,
    collected_amount: 0,
    outstanding_amount: 0,
    by_status: { DRAFT: 0, PENDING: 0, PARTIALLY_PAID: 0, PAID: 0, CANCELLED: 0 },
  };

  return {
    state: {
      effectiveBranchId,
      summary,
    },
    capabilities,
    queries: {
      branches,
      summaryQuery,
      invoicesQuery,
    },
    actions: {
      setSelectedBranchId,
    }
  };
}
