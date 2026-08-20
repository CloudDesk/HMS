import { usePatientHistory } from './usePatients';
import { useAuth } from '../../auth/useAuth';
import type { AuthRole } from '../../auth/auth-types';

const hasRoleCode = (roles: AuthRole[] | undefined, code: string): boolean =>
  roles?.some((r) => r.code === code) ?? false;

export function usePatientHistoryFeature(patientId: string | null) {
  const { user } = useAuth();
  
  const { 
    data: history, 
    isLoading: loading, 
    error,
    refetch
  } = usePatientHistory(patientId, Boolean(patientId));

  const loadError = error?.message || '';

  const isSuperAdmin = hasRoleCode(user?.roles, 'SUPER_ADMIN');
  const isDoctor = hasRoleCode(user?.roles, 'DOCTOR');
  const isNurse = hasRoleCode(user?.roles, 'NURSE');
  
  const canViewHistory = isSuperAdmin || isDoctor || isNurse || hasRoleCode(user?.roles, 'RECEPTIONIST');

  return {
    state: {
      history,
      loading,
      loadError,
      patientId,
    },
    capabilities: {
      canViewHistory,
    },
    actions: {
      retry: () => refetch(),
    }
  };
}
