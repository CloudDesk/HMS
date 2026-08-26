import { useCallback, useMemo, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppLocation, navigate } from '../../routing/navigation';
import { type ApiAppointmentPriority, type ApiAppointmentStatus, isApiAppointmentStatus, isApiAppointmentPriority } from '../../api/appointments';
import { type CreateOpdVitalsPayload, type OpdVisitResponse } from '../../api/opd';
import { getAppointmentErrorMessage, todayInputValue } from '../../pages/appointment-utils';
import { appointmentsKeys, useAppointmentsList, useUpdateAppointmentStatus } from './useAppointments';
import { opdKeys, useCreateOpdVisit, useCreateOpdVitals, useOpdVisits, useUpdateOpdVisitStatus } from '../opd/useOpd';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { useUnreadNotifications } from '../notifications/useNotifications';
import { useDepartmentsList } from '../departments/useDepartments';
import { useDoctorsList } from '../doctors/useDoctors';
import { useBranchesList } from '../branches/useBranches';

export type QueueStatusFilter = ApiAppointmentStatus | '';
export type QueuePriorityFilter = ApiAppointmentPriority | '';

const waitingStatuses = new Set<ApiAppointmentStatus>(['SCHEDULED', 'CONFIRMED', 'SKIPPED']);

const toMinutes = (value: string) => {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const queueSort = (left: { status: string; priority: string; start_time: string }, right: { status: string; priority: string; start_time: string }) => {
  if (left.status === 'SKIPPED' && right.status !== 'SKIPPED') return 1;
  if (left.status !== 'SKIPPED' && right.status === 'SKIPPED') return -1;
  if (left.priority === 'EMERGENCY' && right.priority !== 'EMERGENCY') return -1;
  if (left.priority !== 'EMERGENCY' && right.priority === 'EMERGENCY') return 1;
  return toMinutes(left.start_time) - toMinutes(right.start_time);
};

export function useAppointmentQueueFeature() {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.roles?.some((role) => role.code === 'SUPER_ADMIN'));
  const canCreateVitals = isSuperAdmin || hasPermission(user?.permissions ?? [], { module: 'OPD', screen: 'OPD Vitals', action: 'Create' });
  const canEditVisit = isSuperAdmin || hasPermission(user?.permissions ?? [], { module: 'OPD', screen: 'OPD Visits', action: 'Edit' });
  const { search } = useAppLocation();
  const initialParams = new URLSearchParams(search);

  const [departmentFilter, setDepartmentFilter] = useState(initialParams.get('department_id') ?? '');
  const [doctorFilter, setDoctorFilter] = useState(initialParams.get('doctor_id') ?? '');
  
  const initialStatus = initialParams.get('status');
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>(
    isApiAppointmentStatus(initialStatus) ? initialStatus : ''
  );
  
  const initialPriority = initialParams.get('priority');
  const [priorityFilter, setPriorityFilter] = useState<QueuePriorityFilter>(
    isApiAppointmentPriority(initialPriority) ? initialPriority : ''
  );
  
  const [branchFilter, setBranchFilter] = useState(initialParams.get('branch_id') ?? '');
  const [queueDate, setQueueDate] = useState(initialParams.get('date') ?? todayInputValue());

  useEffect(() => {
    const params = new URLSearchParams();
    if (departmentFilter) params.set('department_id', departmentFilter);
    if (doctorFilter) params.set('doctor_id', doctorFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (priorityFilter) params.set('priority', priorityFilter);
    if (branchFilter) params.set('branch_id', branchFilter);
    if (queueDate !== todayInputValue()) params.set('date', queueDate);
    
    const query = params.toString();
    const nextUrl = `/appointments/queue${query ? `?${query}` : ''}`;
    if (window.location.pathname + window.location.search !== nextUrl) {
      navigate(nextUrl, { replace: true });
    }
  }, [branchFilter, departmentFilter, doctorFilter, priorityFilter, queueDate, statusFilter]);

  const { data: deptData } = useDepartmentsList({ status: 'ACTIVE', limit: 100 });
  const { data: docData } = useDoctorsList({ status: 'ACTIVE', limit: 100, sortBy: 'display_name', sortOrder: 'asc' });
  const { data: branchData } = useBranchesList({ status: 'ACTIVE', limit: 100, sortBy: 'name', sortOrder: 'asc' });

  const departments = deptData?.data || [];
  const doctors = docData?.data || [];
  const branches = branchData?.data || [];

  const queryClient = useQueryClient();
  const appointmentsQuery = useAppointmentsList({
    date_from: queueDate,
    date_to: queueDate,
    department_id: departmentFilter || undefined,
    doctor_id: doctorFilter || undefined,
    branch_id: branchFilter || undefined,
    status: statusFilter || undefined,
    limit: 100,
    sortBy: 'start_time',
    sortOrder: 'asc',
  });

  const opdVisitsQuery = useOpdVisits({
    date_from: queueDate,
    date_to: queueDate,
    department_id: departmentFilter || undefined,
    doctor_id: doctorFilter || undefined,
    branch_id: branchFilter || undefined,
    limit: 100,
  });
  const notificationsQuery = useUnreadNotifications(
    isSuperAdmin || hasPermission(user?.permissions ?? [], { module: 'Appointments', screen: 'Appointment Records' }),
  );

  const updateStatus = useUpdateAppointmentStatus();
  const createVisit = useCreateOpdVisit();
  const updateVisit = useUpdateOpdVisitStatus();
  const createVitals = useCreateOpdVitals();

  const appointments = useMemo(() => {
    let list = appointmentsQuery.data?.data || [];
    if (priorityFilter) {
      list = list.filter((a) => a.priority === priorityFilter);
    }
    return [...list].sort(queueSort);
  }, [appointmentsQuery.data?.data, priorityFilter]);

  const opdVisits = opdVisitsQuery.data?.data || [];
  const callNotifications = (notificationsQuery.data?.data ?? []).filter((notification) => notification.type === 'CALL_NEXT_PATIENT');
  
  const loading = appointmentsQuery.isLoading || opdVisitsQuery.isLoading;
  const loadError = appointmentsQuery.error ? getAppointmentErrorMessage(appointmentsQuery.error) : '';
  const opdLoadError = opdVisitsQuery.error ? getAppointmentErrorMessage(opdVisitsQuery.error) : '';
  const updating = updateStatus.isPending || createVisit.isPending || updateVisit.isPending || createVitals.isPending;

  const currentAppointment = appointments.find((a) => a.status === 'CHECKED_IN') ?? null;
  const nextAppointment = appointments.find((a) => waitingStatuses.has(a.status)) ?? null;

  const visitForAppointment = useCallback(
    (appointmentId: string): OpdVisitResponse | null => {
      return opdVisits.find((visit) => visit.appointment_id === appointmentId) ?? null;
    },
    [opdVisits]
  );

  const handleCallNext = async () => {
    if (currentAppointment) {
      toast.error('Complete or skip the current patient first.');
      return;
    }

    if (!nextAppointment) {
      toast.error('No waiting patient is available in the queue.');
      return;
    }

    const linkedVisit = visitForAppointment(nextAppointment.id);
    if (linkedVisit) {
      await updateStatus.mutateAsync({
        id: nextAppointment.id,
        payload: { status: 'CHECKED_IN', notes: 'Patient called from appointment queue.' },
      });
      await queryClient.invalidateQueries({ queryKey: opdKeys.visits() });
      return;
    }

    try {
      await createVisit.mutateAsync({
        appointment_id: nextAppointment.id,
        notes: 'Patient checked in from appointment queue.',
      });
      await queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() });
    } catch {
      // toast is handled in mutation
    }
  };

  const handleSkip = async () => {
    if (!currentAppointment) {
      toast.error('Call a patient before skipping the queue token.');
      return;
    }
    await updateStatus.mutateAsync({
      id: currentAppointment.id,
      payload: { status: 'SKIPPED', notes: 'Patient skipped and moved behind waiting tokens.' },
    });
    await queryClient.invalidateQueries({ queryKey: opdKeys.visits() });
  };

  const handleNoShow = async () => {
    if (!currentAppointment) {
      toast.error('Call a patient before marking no show.');
      return;
    }

    const linkedVisit = visitForAppointment(currentAppointment.id);
    if (!linkedVisit) {
      await updateStatus.mutateAsync({
        id: currentAppointment.id,
        payload: { status: 'NO_SHOW', notes: 'Patient did not appear after queue call.' },
      });
      await queryClient.invalidateQueries({ queryKey: opdKeys.visits() });
      return;
    }

    await updateVisit.mutateAsync({
      id: linkedVisit.id,
      payload: { status: 'NO_SHOW', notes: 'Patient did not appear after queue call.' },
    });
    await queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() });
  };

  const handleComplete = async (notes: string) => {
    if (!currentAppointment) {
      toast.error('Call a patient before completing the visit.');
      return;
    }

    const linkedVisit = visitForAppointment(currentAppointment.id);
    if (!linkedVisit) {
      throw new Error('This appointment must be checked in to OPD before it can be completed.');
    }

    await updateVisit.mutateAsync({
      id: linkedVisit.id,
      payload: { status: 'COMPLETED', notes },
    });
    await queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() });
  };

  const handleSaveVitals = async (visit: OpdVisitResponse, payload: CreateOpdVitalsPayload) => {
    if (!canCreateVitals || !canEditVisit) {
      throw new Error('You do not have permission to record vitals for this visit.');
    }
    if (visit.status !== 'CHECKED_IN' && visit.status !== 'WAITING_FOR_VITALS') {
      throw new Error('Vitals can only be recorded while the patient is checked in or waiting for vitals.');
    }
    await createVitals.mutateAsync({ visitId: visit.id, payload });
    await updateVisit.mutateAsync({ id: visit.id, payload: { status: 'READY_FOR_CONSULTATION' } });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: opdKeys.visits() }),
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() }),
    ]);
  };

  return {
    state: {
      departmentFilter,
      doctorFilter,
      statusFilter,
      priorityFilter,
      branchFilter,
      queueDate,
      departments,
      doctors,
      branches,
      appointments,
      opdVisits,
      callNotifications,
      loading,
      loadError,
      opdLoadError,
      updating,
      currentAppointment,
      nextAppointment,
      canCreateVitals,
      canEditVisit,
    },
    actions: {
      setDepartmentFilter,
      setDoctorFilter,
      setStatusFilter,
      setPriorityFilter,
      setBranchFilter,
      setQueueDate,
      visitForAppointment,
      handleCallNext,
      handleSkip,
      handleNoShow,
      handleComplete,
      handleSaveVitals,
    }
  };
}
