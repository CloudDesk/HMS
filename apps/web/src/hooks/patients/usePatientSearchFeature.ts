import { useState } from 'react';
import { usePatientsList, useUpdatePatient } from './usePatients';
import { type ApiPatientGender, type ApiPatientStatus } from '../../api/patients';

type SortColumn = 'patient_number' | 'first_name' | 'last_name' | 'created_at';
type SortDirection = 'asc' | 'desc';

export function usePatientSearchFeature({ appliedFilters, currentPage }: { appliedFilters: { searchTerms: string; status: ApiPatientStatus | ''; gender: ApiPatientGender | '' }, currentPage: number }) {
  const [sortColumn] = useState<SortColumn | null>('created_at');
  const [sortDirection] = useState<SortDirection>('desc');

  const { data: patientsList, isLoading: loading, error: loadError } = usePatientsList({
    search: appliedFilters.searchTerms || undefined,
    status: appliedFilters.status || undefined,
    gender: appliedFilters.gender || undefined,
    page: currentPage,
    limit: 10,
    sortBy: sortColumn || undefined,
    sortOrder: sortColumn ? sortDirection : undefined,
  });

  const patients = patientsList?.data ?? [];
  const meta = patientsList?.meta ?? { page: 1, limit: 10, total: 0, totalPages: 1 };

  const { mutateAsync: updatePatient } = useUpdatePatient();

  return {
    state: {
      patients,
      meta,
      loading,
      loadError,
    },
    mutations: {
      updatePatient,
    },
  };
}

