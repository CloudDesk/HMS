import { usePatientHistory } from './usePatients';
import { useAuth } from '../../auth/useAuth';
import { hasPermission, isSuperAdministrator } from '../../auth/access-control';

export function usePatientHistoryFeature(patientId: string | null) {
  const { user } = useAuth();
  
  const { 
    data: history, 
    isLoading: loading, 
    error,
    refetch
  } = usePatientHistory(patientId, Boolean(patientId));

  const loadError = error?.message || '';

  const canViewHistory = Boolean(user && (
    isSuperAdministrator(user.roles) ||
    hasPermission(user.permissions, { module: 'Patients', screen: 'Patient Records', action: 'View' })
  ));

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
