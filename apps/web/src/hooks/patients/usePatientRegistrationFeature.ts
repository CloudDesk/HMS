import { useEffect, useMemo } from 'react';
import type { SavePatientPayload } from '../../api/patients';
import { useAuth } from '../../auth/useAuth';
import { useActiveBranch } from '../../context/BranchContext';
import { useBranchesList } from '../branches/useBranches';
import { useCreatePatient } from './usePatients';

type PatientRegistrationFeatureOptions = {
  registrationBranchId: string;
  onRegistrationBranchChange: (branchId: string) => void;
};

export function usePatientRegistrationFeature({
  registrationBranchId,
  onRegistrationBranchChange,
}: PatientRegistrationFeatureOptions) {
  const { user } = useAuth();
  const { activeBranchId } = useActiveBranch();
  const branchesQuery = useBranchesList({ status: 'ACTIVE', limit: 100 });
  const branches = useMemo(() => branchesQuery.data?.data ?? [], [branchesQuery.data?.data]);
  const createPatient = useCreatePatient({ notify: false });

  useEffect(() => {
    if (branches.length === 0 || registrationBranchId) return;

    const userBranchId = user?.branches?.[0]?.id;
    const targetBranchId = activeBranchId || userBranchId;
    const matchedBranch = targetBranchId ? branches.find((branch) => branch.id === targetBranchId) : undefined;
    const defaultBranchId = matchedBranch?.id || branches[0]?.id || '';

    if (defaultBranchId) onRegistrationBranchChange(defaultBranchId);
  }, [activeBranchId, branches, onRegistrationBranchChange, registrationBranchId, user]);

  const registerPatient = (payload: SavePatientPayload) => createPatient.mutateAsync(payload);

  return {
    state: {
      branches,
      submitting: createPatient.isPending,
    },
    actions: {
      registerPatient,
    },
  };
}
