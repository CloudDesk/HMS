import { useMemo } from 'react';
import { useOpdVisits, useCreateOpdVisit, useUpdateOpdVisitStatus, useCreateOpdVitals } from './useOpd';
import { useAppointmentsList as useAppointments } from '../appointments/useAppointments';
import { useDoctorsList as useDoctors } from '../doctors/useDoctors';
import { useDepartmentsList as useDepartments } from '../departments/useDepartments';
import { usePatientsList as usePatients } from '../patients/usePatients';
import { type ApiOpdVisitPriority, type ApiOpdVisitStatus } from '../../api/opd';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';

export type OpdQueueFilters = {
  search?: string;
  department_id?: string;
  doctor_id?: string;
  status?: ApiOpdVisitStatus | '';
  priority?: ApiOpdVisitPriority | '';
  date: string;
};

export function useOpdQueue(filters: OpdQueueFilters) {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.roles?.some((role) => role.code === 'SUPER_ADMIN'));
  const canAccess = (module: string, screen: string) =>
    isSuperAdmin || hasPermission(user?.permissions ?? [], { module, screen });

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
  }, canAccess('OPD', 'OPD Visits'));

  const { data: appointmentsData, isLoading: appointmentsLoading, error: appointmentsError } = useAppointments({
    search: filters.search || undefined,
    doctor_id: filters.doctor_id || undefined,
    department_id: filters.department_id || undefined,
    date_from: filters.date,
    date_to: filters.date,
    limit: 100,
    sortBy: 'start_time',
    sortOrder: 'asc',
  }, canAccess('Appointments', 'Appointment Records'));

  const { data: doctorsData, isLoading: doctorsLoading } = useDoctors(
    { status: 'ACTIVE', limit: 100, sortBy: 'display_name', sortOrder: 'asc' },
    canAccess('Doctors', 'Doctor Directory')
  );
  
  const { data: departmentsData, isLoading: departmentsLoading } = useDepartments(
    { status: 'ACTIVE', limit: 100 },
    canAccess('Administration', 'Departments')
  );
  
  const { data: patientsData, isLoading: patientsLoading } = usePatients(
    { status: 'ACTIVE', limit: 100, sortBy: 'created_at', sortOrder: 'desc' },
    canAccess('Patients', 'Patient Records')
  );

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
