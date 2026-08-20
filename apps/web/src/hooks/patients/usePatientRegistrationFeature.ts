import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useCreatePatient } from './usePatients';
import { useBranchesList } from '../branches/useBranches';
import { type PatientResponse } from '../../api/patients';
import { UseFormReturn, FieldValues } from 'react-hook-form';

export function usePatientRegistrationFeature<T extends FieldValues>(form: UseFormReturn<T>) {
  const { user } = useAuth();
  const { data: branchesRes } = useBranchesList({ status: 'ACTIVE', limit: 100 });
  const branches = useMemo(() => branchesRes?.data || [], [branchesRes?.data]);
  
  const [formError, setFormError] = useState('');
  const [duplicatePatients, setDuplicatePatients] = useState<PatientResponse[]>([]);
  const { mutateAsync: createPatient, isPending: submitting } = useCreatePatient();
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');

  const { watch, setValue } = form;

  useEffect(() => {
    // @ts-expect-error - generic form keys
    if (branches.length > 0 && !watch('registrationBranchId')) {
      const activeId = localStorage.getItem('activeBranchId');
      const userBranchId = user?.branches?.[0]?.id;
      const targetBranchId = activeId || userBranchId;
      const matchedBranch = targetBranchId ? branches.find((b) => b.id === targetBranchId) : undefined;
      const defaultBranch = matchedBranch ? matchedBranch.id : (branches[0]?.id || '');
      if (defaultBranch) {
        // @ts-expect-error - generic form keys
        setValue('registrationBranchId', defaultBranch);
      }
    }
  }, [branches, user, setValue, watch]);

  return {
    state: {
      branches,
      formError,
      duplicatePatients,
      toastMessage,
      toastVisible,
      toastTone,
    },
    actions: {
      setFormError,
      setDuplicatePatients,
      setToastMessage,
      setToastVisible,
      setToastTone,
    },
    mutations: {
      createPatient,
      submitting,
    },
  };
}


