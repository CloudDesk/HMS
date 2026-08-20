import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  appointmentsApi,
  type AppointmentListParams,
  type SaveAppointmentPayload,
  type UpdateAppointmentStatusPayload,
} from '../../api/appointments';
import { getAppointmentErrorMessage } from '../../pages/appointment-utils';

export const appointmentsKeys = {
  all: ['appointments'] as const,
  lists: () => [...appointmentsKeys.all, 'lists'] as const,
  list: (params: AppointmentListParams) => [...appointmentsKeys.lists(), params] as const,
  details: () => [...appointmentsKeys.all, 'details'] as const,
  detail: (id: string) => [...appointmentsKeys.details(), id] as const,
};

export function useAppointmentsList(params: AppointmentListParams = {}, enabled = true) {
  return useQuery({
    queryKey: appointmentsKeys.list(params),
    queryFn: () => appointmentsApi.list(params),
    enabled,
  });
}

export function useAppointmentDetails(id: string | null, enabled = true) {
  return useQuery({
    queryKey: id ? appointmentsKeys.detail(id) : appointmentsKeys.details(),
    queryFn: () => appointmentsApi.getById(id!),
    enabled: enabled && Boolean(id),
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveAppointmentPayload) => appointmentsApi.create(payload),
    onSuccess: async () => {
      toast.success('Appointment booked successfully.');
      await queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() });
    },
    onError: (error) => toast.error(getAppointmentErrorMessage(error)),
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<SaveAppointmentPayload> }) =>
      appointmentsApi.update(id, payload),
    onSuccess: async (result) => {
      toast.success('Appointment updated successfully.');
      await queryClient.invalidateQueries({ queryKey: appointmentsKeys.detail(result.id) });
      await queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() });
    },
    onError: (error) => toast.error(getAppointmentErrorMessage(error)),
  });
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAppointmentStatusPayload }) =>
      appointmentsApi.updateStatus(id, payload),
    onSuccess: async (result) => {
      toast.success(`Appointment status updated to ${result.status.toLowerCase()}.`);
      await queryClient.invalidateQueries({ queryKey: appointmentsKeys.detail(result.id) });
      await queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() });
    },
    onError: (error) => toast.error(getAppointmentErrorMessage(error)),
  });
}
