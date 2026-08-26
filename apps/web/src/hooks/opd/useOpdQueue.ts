import { useMemo } from 'react';
import { useOpdVisits, useUpdateOpdVisitStatus } from './useOpd';
import { useDoctorsList as useDoctors } from '../doctors/useDoctors';
import { useDepartmentsList as useDepartments } from '../departments/useDepartments';
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
  const canAction = (module: string, screen: string, action: string) =>
    isSuperAdmin || hasPermission(user?.permissions ?? [], { module, screen, action });

  // Capability flags — owned here so pages never need to traverse permissions
  const canEditVisit = canAction('OPD', 'OPD Visits', 'Edit');

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
  }, canAccess('OPD', 'OPD Visits'), 5_000);

  const { data: doctorsData, isLoading: doctorsLoading } = useDoctors(
    { status: 'ACTIVE', limit: 100, sortBy: 'display_name', sortOrder: 'asc' },
    canAccess('Doctors', 'Doctor Directory')
  );
  
  const { data: departmentsData, isLoading: departmentsLoading } = useDepartments(
    { status: 'ACTIVE', limit: 100 },
    canAccess('Administration', 'Departments')
  );
  
  // Mutations
  const { mutateAsync: updateVisitStatus, isPending: isUpdatingVisit } = useUpdateOpdVisitStatus();

  const visits = useMemo(() => {
    let filtered = visitsData?.data ?? [];
    if (filters.priority) {
      filtered = filtered.filter((visit) => visit.priority === filters.priority);
    }
    return filtered;
  }, [visitsData, filters.priority]);

  const doctors = doctorsData?.data ?? [];
  const departments = departmentsData?.data ?? [];
  const isLoading = visitsLoading || doctorsLoading || departmentsLoading;
  const error = visitsError;
  const isUpdating = isUpdatingVisit;

  return {
    visits,
    doctors,
    departments,
    isLoading,
    error,
    isUpdating,
    updateVisitStatus,
    // Capability flags
    canEditVisit,
  };
}
