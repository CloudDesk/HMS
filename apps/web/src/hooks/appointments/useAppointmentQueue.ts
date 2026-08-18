import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { type ApiAppointmentPriority, type ApiAppointmentStatus } from '../../api/appointments';
import { type OpdVisitResponse } from '../../api/opd';
import { getAppointmentErrorMessage } from '../../pages/appointment-utils';
import { appointmentsKeys, useAppointmentsList, useUpdateAppointmentStatus } from './useAppointments';
import { opdKeys, useCreateOpdVisit, useOpdVisits, useUpdateOpdVisitStatus } from '../opd/useOpd';

export type QueueFilters = {
  department_id?: string;
  doctor_id?: string;
  branch_id?: string;
  status?: ApiAppointmentStatus;
  priority?: ApiAppointmentPriority;
  date: string;
};

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

export function useAppointmentQueue(filters: QueueFilters) {
  const queryClient = useQueryClient();
  const appointmentsQuery = useAppointmentsList({
    date_from: filters.date,
    date_to: filters.date,
    department_id: filters.department_id,
    doctor_id: filters.doctor_id,
    branch_id: filters.branch_id,
    status: filters.status,
    limit: 100,
    sortBy: 'start_time',
    sortOrder: 'asc',
  });

  const opdVisitsQuery = useOpdVisits({
    date_from: filters.date,
    date_to: filters.date,
    department_id: filters.department_id,
    doctor_id: filters.doctor_id,
    branch_id: filters.branch_id,
    limit: 100,
  });

  const updateStatus = useUpdateAppointmentStatus();
  const createVisit = useCreateOpdVisit();
  const updateVisit = useUpdateOpdVisitStatus();

  const appointments = useMemo(() => {
    let list = appointmentsQuery.data?.data || [];
    if (filters.priority) {
      list = list.filter((a) => a.priority === filters.priority);
    }
    return [...list].sort(queueSort);
  }, [appointmentsQuery.data?.data, filters.priority]);

  const opdVisits = opdVisitsQuery.data?.data || [];
  
  const loading = appointmentsQuery.isLoading || opdVisitsQuery.isLoading;
  const loadError = appointmentsQuery.error ? getAppointmentErrorMessage(appointmentsQuery.error) : '';
  const opdLoadError = opdVisitsQuery.error ? getAppointmentErrorMessage(opdVisitsQuery.error) : '';
  const updating = updateStatus.isPending || createVisit.isPending || updateVisit.isPending;

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

  return {
    appointments,
    opdVisits,
    loading,
    loadError,
    opdLoadError,
    updating,
    currentAppointment,
    nextAppointment,
    visitForAppointment,
    handleCallNext,
    handleSkip,
    handleNoShow,
    handleComplete,
  };
}
