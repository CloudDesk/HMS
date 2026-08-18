import { useMemo } from 'react';
import { useOpdVisits, useCreateOpdVisit, useUpdateOpdVisitStatus, useCreateOpdVitals } from './useOpd';
import { useAppointmentsList as useAppointments, useCreateAppointment, useUpdateAppointmentStatus } from '../appointments/useAppointments';
import { useDoctorsList as useDoctors } from '../doctors/useDoctors';
import { useDepartmentsList as useDepartments } from '../departments/useDepartments';
import { usePatientsList as usePatients } from '../patients/usePatients';
import { type ApiOpdVisitPriority, type ApiOpdVisitStatus } from '../../api/opd';

export type OpdQueueFilters = {
  search?: string;
  department_id?: string;
  doctor_id?: string;
  status?: ApiOpdVisitStatus | '';
  priority?: ApiOpdVisitPriority | '';
  date: string;
};

export function useOpdQueue(filters: OpdQueueFilters) {
  // Queries
  const { data: visitsData, isLoading: visitsLoading, error: visitsError } = useOpdVisits({
    search: filters.search || undefined,
    status: filters.status || undefined,
    doctor_id: filters.doctor_id || undefined,
    department_id: filters.department_id || undefined,
    date_from: filters.date,
    date_to: filters.date,
    limit: 100,
    sortBy: 'check_in_time',
    sortOrder: 'asc',
  });

  const { data: appointmentsData, isLoading: appointmentsLoading, error: appointmentsError } = useAppointments({
    search: filters.search || undefined,
    doctor_id: filters.doctor_id || undefined,
    department_id: filters.department_id || undefined,
    date_from: filters.date,
    date_to: filters.date,
    limit: 100,
    sortBy: 'start_time',
    sortOrder: 'asc',
  });

  const { data: doctorsData, isLoading: doctorsLoading } = useDoctors({ status: 'ACTIVE', limit: 100, sortBy: 'display_name', sortOrder: 'asc' });
  const { data: departmentsData, isLoading: departmentsLoading } = useDepartments({ status: 'ACTIVE', limit: 100 });
  const { data: patientsData, isLoading: patientsLoading } = usePatients({ status: 'ACTIVE', limit: 100, sortBy: 'created_at', sortOrder: 'desc' });

  // Mutations
  const { mutateAsync: createVisit, isPending: isCreatingVisit } = useCreateOpdVisit();
  const { mutateAsync: updateVisitStatus, isPending: isUpdatingVisit } = useUpdateOpdVisitStatus();
  const { mutateAsync: createVitals, isPending: isCreatingVitals } = useCreateOpdVitals();

  const visits = useMemo(() => {
    let filtered = visitsData?.data ?? [];
    if (filters.priority) {
      filtered = filtered.filter((visit) => visit.priority === filters.priority);
    }
    return filtered;
  }, [visitsData, filters.priority]);

  const appointments = appointmentsData?.data ?? [];
  const doctors = doctorsData?.data ?? [];
  const departments = departmentsData?.data ?? [];
  const patients = patientsData?.data ?? [];

  const isLoading = visitsLoading || appointmentsLoading || doctorsLoading || departmentsLoading || patientsLoading;
  const error = visitsError || appointmentsError;
  const isUpdating = isCreatingVisit || isUpdatingVisit || isCreatingVitals;

  return {
    visits,
    appointments,
    doctors,
    departments,
    patients,
    isLoading,
    error,
    isUpdating,
    createVisit,
    updateVisitStatus,
    createVitals,
  };
}
