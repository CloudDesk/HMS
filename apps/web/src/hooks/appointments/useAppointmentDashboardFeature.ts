import { useState, useEffect } from 'react';
import { useAppLocation, navigate } from '../../routing/navigation';
import { useAppointmentDashboardSummary, useAppointmentsList, useUpdateAppointmentStatus } from './useAppointments';
import { type ApiAppointmentStatus, isApiAppointmentStatus } from '../../api/appointments';
import { todayInputValue } from '../../pages/appointment-utils';
import { useAuth } from '../../auth/useAuth';
import { hasPermission, isSuperAdministrator } from '../../auth/access-control';

export type SortColumn = 'appointment_date' | 'start_time' | 'created_at';
export type SortDirection = 'asc' | 'desc';

export const isSortColumn = (value: unknown): value is SortColumn => {
  return typeof value === 'string' && ['appointment_date', 'start_time', 'created_at'].includes(value);
};

export function useAppointmentDashboardFeature() {
  const { user } = useAuth();
  const superAdmin = isSuperAdministrator(user?.roles ?? []);
  const can = (module: string, screen: string, action: string) => superAdmin || hasPermission(
    user?.permissions ?? [], { module, screen, action },
  );
  const canCreateBooking = can('Appointments', 'Appointment Booking', 'View') &&
    can('Appointments', 'Appointment Booking', 'Create') &&
    can('Patients', 'Patient Records', 'View') &&
    can('Doctors', 'Doctor Directory', 'View') &&
    can('Doctors', 'Doctor Availability', 'View');
  const canEditStatus = can('Appointments', 'Appointment Records', 'Edit');
  const canViewPatients = can('Patients', 'Patient Records', 'View');
  const canViewQueue = can('Appointments', 'Appointment Records', 'View') && can('OPD', 'OPD Visits', 'View');
  const location = useAppLocation();
  const initialParams = new URLSearchParams(location.search);
  
  const [search, setSearch] = useState(initialParams.get('search') ?? '');
  
  const initialStatus = initialParams.get('status');
  const [statusFilter, setStatusFilter] = useState<ApiAppointmentStatus | ''>(
    isApiAppointmentStatus(initialStatus) ? initialStatus : ''
  );
  
  const [dateFrom, setDateFrom] = useState(initialParams.get('date_from') ?? todayInputValue());
  const [dateTo, setDateTo] = useState(initialParams.get('date_to') ?? todayInputValue());
  const [currentPage, setCurrentPage] = useState(Number(initialParams.get('page')) || 1);
  
  const initialSortBy = initialParams.get('sortBy');
  const [sortColumn, setSortColumn] = useState<SortColumn>(
    isSortColumn(initialSortBy) ? initialSortBy : 'appointment_date'
  );
  
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    initialParams.get('sortOrder') === 'desc' ? 'desc' : 'asc'
  );

  const can = (module: string, screen: string, action = 'View') => {
    if (!user) return false;
    return isSuperAdministrator(user.roles) ||
      hasPermission(user.permissions, { module, screen, action });
  };

  const capabilities = {
    canBook: can('Appointments', 'Appointment Booking', 'Create'),
    canEditStatus: can('Appointments', 'Appointment Records', 'Edit'),
    canSearchPatients: can('Patients', 'Patient Records', 'View'),
    canViewQueue: can('Appointments', 'Appointment Records', 'View'),
  };

  const { data, isLoading: loading, isError, error, refetch } = useAppointmentsList({
    search: search.trim() || undefined,
    status: statusFilter || undefined,
    branch_id: activeBranchId || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    page: currentPage,
    limit: 10,
    sortBy: sortColumn,
    sortOrder: sortDirection,
  });
  const summaryQuery = useAppointmentDashboardSummary({
    search: search.trim() || undefined,
    status: statusFilter || undefined,
    branch_id: activeBranchId || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  }, capabilities.canViewQueue);

  const updateStatus = useUpdateAppointmentStatus();

  const appointments = data?.data || [];
  const meta = data?.meta || { limit: 10, page: currentPage, total: 0, totalPages: 1 };
  const loadError = isError && error instanceof Error ? error.message : isError ? 'Failed to load' : '';

  // Sync state to URL when filters change
  useEffect(() => {
    if (location.pathname !== '/appointments') return;

    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (dateFrom && dateFrom !== todayInputValue()) params.set('date_from', dateFrom);
    if (dateTo && dateTo !== todayInputValue()) params.set('date_to', dateTo);
    if (currentPage > 1) params.set('page', String(currentPage));
    if (sortColumn !== 'appointment_date') params.set('sortBy', sortColumn);
    if (sortDirection !== 'asc') params.set('sortOrder', sortDirection);

    const nextUrl = `/appointments?${params.toString()}`;
    if (window.location.pathname + window.location.search !== nextUrl) {
      navigate(nextUrl, { replace: true });
    }
  }, [location.pathname, search, statusFilter, dateFrom, dateTo, currentPage, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    setSortColumn((current) => {
      if (current === column) {
        setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
        return current;
      }
      setSortDirection('asc');
      return column;
    });
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setDateFrom(todayInputValue());
    setDateTo(todayInputValue());
    setSortColumn('appointment_date');
    setSortDirection('asc');
    setCurrentPage(1);
  };

  const handleUpdateStatus = async (id: string, status: ApiAppointmentStatus) => {
    if (!canEditStatus) throw new Error('You do not have permission to update appointment status.');
    return updateStatus.mutateAsync({ id, payload: { status } });
  };

  return {
    state: {
      search,
      statusFilter,
      dateFrom,
      dateTo,
      currentPage,
      sortColumn,
      sortDirection,
      appointments,
      meta,
      loading,
      loadError,
      isUpdatingStatus: updateStatus.isPending,
      canCreateBooking,
      canEditStatus,
      canViewPatients,
      canViewQueue,
    },
    capabilities,
    actions: {
      setSearch,
      setStatusFilter,
      setDateFrom,
      setDateTo,
      setCurrentPage,
      handleSort,
      resetFilters,
      handleUpdateStatus,
      refetch: async () => { await Promise.all([refetch(), summaryQuery.refetch()]); },
    }
  };
}
