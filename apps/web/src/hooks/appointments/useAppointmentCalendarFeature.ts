import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useAppLocation, navigate } from '../../routing/navigation';
import { useAppointmentsList, useUpdateAppointment, useUpdateAppointmentStatus } from './useAppointments';
import { useDepartmentsList } from '../departments/useDepartments';
import { useDoctorsList } from '../doctors/useDoctors';
import { useBranchesList } from '../branches/useBranches';
import { type ApiAppointmentStatus, isApiAppointmentStatus } from '../../api/appointments';
import { todayInputValue, toInputDate, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from '../../pages/appointment-utils';

export type CalendarMode = 'day' | 'week' | 'month';

export const isCalendarMode = (value: unknown): value is CalendarMode => {
  return typeof value === 'string' && ['day', 'week', 'month'].includes(value);
};

const buildDateRange = (mode: CalendarMode, selectedDate: string) => {
  if (mode === 'day') {
    return { from: selectedDate, to: selectedDate };
  }

  if (mode === 'month') {
    return { from: toInputDate(startOfMonth(selectedDate)), to: toInputDate(endOfMonth(selectedDate)) };
  }

  return { from: toInputDate(startOfWeek(selectedDate)), to: toInputDate(endOfWeek(selectedDate)) };
};

export function useAppointmentCalendarFeature() {
  const { user } = useAuth();
  const { search } = useAppLocation();
  const initialParams = new URLSearchParams(search);

  const initialView = initialParams.get('view');
  const [mode, setMode] = useState<CalendarMode>(isCalendarMode(initialView) ? initialView : 'week');
  
  const [calendarDate, setCalendarDate] = useState(initialParams.get('date') ?? todayInputValue());
  const [departmentFilter, setDepartmentFilter] = useState(initialParams.get('department_id') ?? '');
  const [doctorFilter, setDoctorFilter] = useState(initialParams.get('doctor_id') ?? '');
  
  const initialStatus = initialParams.get('status');
  const [statusFilter, setStatusFilter] = useState<ApiAppointmentStatus | ''>(
    isApiAppointmentStatus(initialStatus) ? initialStatus : ''
  );

  const range = useMemo(() => buildDateRange(mode, calendarDate), [calendarDate, mode]);

  const { data: deptData } = useDepartmentsList({ status: 'ACTIVE', limit: 100 });
  const { data: docData } = useDoctorsList({ status: 'ACTIVE', limit: 100, sortBy: 'display_name', sortOrder: 'asc' });
  const { data: branchData } = useBranchesList({ status: 'ACTIVE', limit: 100 });

  const departments = deptData?.data || [];
  const allDoctors = docData?.data || [];
  const branches = branchData?.data || [];

  const { data: apptData, isLoading: loading, isError, error } = useAppointmentsList({
    date_from: range.from,
    date_to: range.to,
    department_id: departmentFilter || undefined,
    doctor_id: doctorFilter || undefined,
    status: statusFilter || undefined,
    limit: 100,
    sortBy: 'start_time',
    sortOrder: 'asc',
  });

  const appointments = apptData?.data || [];
  const loadError = isError && error instanceof Error ? error.message : isError ? 'Failed to load' : '';

  const updateAppointment = useUpdateAppointment();
  const updateStatus = useUpdateAppointmentStatus();

  const loggedInDoctor = useMemo(
    () => (user ? allDoctors.find((doctor) => doctor.user_id === user.id) : undefined),
    [allDoctors, user],
  );

  const visibleDoctors = useMemo(
    () => allDoctors.filter((doctor) => !departmentFilter || doctor.department_id === departmentFilter),
    [departmentFilter, allDoctors],
  );

  // Auto-set doctor filter if logged in as a doctor
  useEffect(() => {
    if (loggedInDoctor && doctorFilter !== loggedInDoctor.id) {
      setDoctorFilter(loggedInDoctor.id);
      if (loggedInDoctor.department_id && departmentFilter !== loggedInDoctor.department_id) {
        setDepartmentFilter(loggedInDoctor.department_id);
      }
    }
  }, [loggedInDoctor, doctorFilter, departmentFilter]);

  // URL Sync
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('view', mode);
    if (calendarDate !== todayInputValue()) params.set('date', calendarDate);
    if (departmentFilter) params.set('department_id', departmentFilter);
    if (doctorFilter) params.set('doctor_id', doctorFilter);
    if (statusFilter) params.set('status', statusFilter);
    const nextUrl = `/appointments/calendar?${params.toString()}`;
    if (window.location.pathname + window.location.search !== nextUrl) {
      navigate(nextUrl, { replace: true });
    }
  }, [calendarDate, departmentFilter, doctorFilter, mode, statusFilter]);

  const handleUpdateAppointment = async (id: string, payload: { appointment_date: string; start_time: string; reschedule_reason: string }) => {
    return updateAppointment.mutateAsync({ id, payload });
  };

  const handleUpdateStatus = async (id: string, payload: { status: ApiAppointmentStatus; notes?: string }) => {
    return updateStatus.mutateAsync({ id, payload });
  };

  return {
    state: {
      mode,
      calendarDate,
      departmentFilter,
      doctorFilter,
      statusFilter,
      departments,
      allDoctors,
      visibleDoctors,
      branches,
      appointments,
      loading,
      loadError,
      loggedInDoctor,
      isUpdatingAppointment: updateAppointment.isPending,
      isUpdatingStatus: updateStatus.isPending,
    },
    actions: {
      setMode,
      setCalendarDate,
      setDepartmentFilter,
      setDoctorFilter,
      setStatusFilter,
      handleUpdateAppointment,
      handleUpdateStatus,
    }
  };
}
