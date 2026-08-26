import { useEffect, useState } from 'react';
import { useBranchesList } from '../branches/useBranches';
import { useAvailableBeds, useBedAvailabilitySummary } from '../admissions/useBedAvailability';
export function useBedAvailabilityFeature() {
  const branchesQuery = useBranchesList({ status: 'ACTIVE', page: 1, limit: 100 });
  const branches = branchesQuery.data?.data ?? []; const [branchId, setBranchId] = useState('');
  useEffect(() => { if (!branchId && branches[0]) setBranchId(branches[0].id); }, [branchId, branches]);
  const bedsQuery = useAvailableBeds(branchId); const summaryQuery = useBedAvailabilitySummary(branchId);
  return { state: { branches, branchId, beds: bedsQuery.data?.data ?? [], summary: summaryQuery.data,
    loading: branchesQuery.isLoading || bedsQuery.isLoading || summaryQuery.isLoading }, actions: { setBranchId } };
}
