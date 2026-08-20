import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '../../api/api-error';
import {
  doctorsApi,
  type ApiDoctorStatus,
  type CreateDoctorPayload,
  type DoctorExceptionListParams,
  type DoctorLeaveListParams,
  type DoctorListParams,
  type SaveDoctorAvailabilityPayload,
  type SaveDoctorPayload,
} from '../../api/doctors';

export type { DoctorExceptionListParams, DoctorLeaveListParams };
export type CreateDoctorLeavePayload = Parameters<typeof doctorsApi.createLeave>[1];
export type SaveDoctorExceptionPayload = Parameters<typeof doctorsApi.saveException>[1];
export type UpdateDoctorPayload = Partial<Omit<SaveDoctorPayload, 'status'>>;

const getDoctorErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to perform this action.';
    if (error.status === 404) return 'The requested doctor record could not be found.';
    if (error.status === 409) return error.message || 'A doctor record conflict occurred.';
    if (error.status >= 500) return 'The doctor service is unavailable. Please try again shortly.';
    return error.message;
  }
  return 'An unexpected error occurred while processing the doctor record.';
};

export const doctorKeys = {
  all: ['doctors'] as const,
  lists: () => [...doctorKeys.all, 'lists'] as const,
  list: (params: DoctorListParams) => [...doctorKeys.lists(), params] as const,
  details: () => [...doctorKeys.all, 'details'] as const,
  detail: (doctorId: string) => [...doctorKeys.details(), doctorId] as const,
  current: () => [...doctorKeys.details(), 'current'] as const,
  userOptions: () => [...doctorKeys.all, 'user-options'] as const,
  slots: () => [...doctorKeys.all, 'slots'] as const,
  doctorSlots: (doctorId: string) => [...doctorKeys.slots(), doctorId] as const,
  availableSlots: (doctorId: string, date: string) => [...doctorKeys.doctorSlots(doctorId), date] as const,
  leaves: () => [...doctorKeys.all, 'leaves'] as const,
  doctorLeaves: (doctorId: string) => [...doctorKeys.leaves(), doctorId] as const,
  leaveList: (doctorId: string, params: DoctorLeaveListParams) =>
    [...doctorKeys.doctorLeaves(doctorId), 'list', params] as const,
  exceptions: () => [...doctorKeys.all, 'exceptions'] as const,
  doctorExceptions: (doctorId: string) => [...doctorKeys.exceptions(), doctorId] as const,
  exceptionList: (doctorId: string, params: DoctorExceptionListParams) =>
    [...doctorKeys.doctorExceptions(doctorId), 'list', params] as const,
};

export function useDoctorsList(params: DoctorListParams = {}, enabled = true) {
  return useQuery({
    queryKey: doctorKeys.list(params),
    queryFn: () => doctorsApi.list(params),
    enabled,
  });
}

export function useDoctorDetails(doctorId: string | null, enabled = true) {
  return useQuery({
    queryKey: doctorId ? doctorKeys.detail(doctorId) : doctorKeys.details(),
    queryFn: () => {
      if (!doctorId) throw new Error('A doctor ID is required to load doctor details.');
      return doctorsApi.getById(doctorId);
    },
    enabled: enabled && Boolean(doctorId),
  });
}

export function useCurrentDoctor(enabled = true) {
  return useQuery({
    queryKey: doctorKeys.current(),
    queryFn: () => doctorsApi.getCurrent(),
    enabled,
  });
}

export function useDoctorAvailability(doctorId: string | null, enabled = true) {
  return useQuery({
    queryKey: doctorId ? doctorKeys.detail(doctorId) : doctorKeys.details(),
    queryFn: () => {
      if (!doctorId) throw new Error('A doctor ID is required to load availability.');
      return doctorsApi.getById(doctorId);
    },
    select: (doctor) => doctor.availability,
    enabled: enabled && Boolean(doctorId),
  });
}

export function useDoctorUserOptions(enabled = true) {
  return useQuery({
    queryKey: doctorKeys.userOptions(),
    queryFn: () => doctorsApi.userOptions(),
    enabled,
  });
}

export function useExportDoctors() {
  return useMutation({
    mutationFn: (params: DoctorListParams) => doctorsApi.export(params),
  });
}

export function useDoctorAvailableSlots(doctorId: string, date: string, enabled = true) {
  return useQuery({
    queryKey: doctorKeys.availableSlots(doctorId, date),
    queryFn: () => doctorsApi.availableSlots(doctorId, date),
    enabled: enabled && Boolean(doctorId) && Boolean(date),
  });
}

export function useDoctorLeaves(
  doctorId: string | null,
  params: DoctorLeaveListParams = {},
  enabled = true,
) {
  return useQuery({
    queryKey: doctorId ? doctorKeys.leaveList(doctorId, params) : doctorKeys.leaves(),
    queryFn: () => {
      if (!doctorId) throw new Error('A doctor ID is required to load leave records.');
      return doctorsApi.listLeaves(doctorId, params);
    },
    enabled: enabled && Boolean(doctorId),
  });
}

export function useDoctorExceptions(
  doctorId: string | null,
  params: DoctorExceptionListParams = {},
  enabled = true,
) {
  return useQuery({
    queryKey: doctorId ? doctorKeys.exceptionList(doctorId, params) : doctorKeys.exceptions(),
    queryFn: () => {
      if (!doctorId) throw new Error('A doctor ID is required to load availability exceptions.');
      return doctorsApi.listExceptions(doctorId, params);
    },
    enabled: enabled && Boolean(doctorId),
  });
}

export function useCreateDoctor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateDoctorPayload) => doctorsApi.create(payload),
    onSuccess: async () => {
      toast.success('Doctor created successfully.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: doctorKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: doctorKeys.userOptions() }),
      ]);
    },
    onError: (error) => toast.error(getDoctorErrorMessage(error)),
  });
}

export function useUpdateDoctor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDoctorPayload }) => doctorsApi.update(id, payload),
    onSuccess: async (_doctor, { id }) => {
      toast.success('Doctor profile updated.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: doctorKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: doctorKeys.current() }),
        queryClient.invalidateQueries({ queryKey: doctorKeys.lists() }),
      ]);
    },
    onError: (error) => toast.error(getDoctorErrorMessage(error)),
  });
}

export function useUpdateDoctorStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: ApiDoctorStatus; reason: string }) =>
      doctorsApi.updateStatus(id, status, reason),
    onSuccess: async (_doctor, { id }) => {
      toast.success('Doctor status updated.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: doctorKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: doctorKeys.current() }),
        queryClient.invalidateQueries({ queryKey: doctorKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: doctorKeys.doctorSlots(id) }),
      ]);
    },
    onError: (error) => toast.error(getDoctorErrorMessage(error)),
  });
}

export function useMapDoctorUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string | null }) => doctorsApi.mapUser(id, userId),
    onSuccess: async (_doctor, { id }) => {
      toast.success('Doctor user mapping updated.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: doctorKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: doctorKeys.current() }),
        queryClient.invalidateQueries({ queryKey: doctorKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: doctorKeys.userOptions() }),
      ]);
    },
    onError: (error) => toast.error(getDoctorErrorMessage(error)),
  });
}

export function useUpdateDoctorAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SaveDoctorAvailabilityPayload }) =>
      doctorsApi.updateAvailability(id, payload),
    onSuccess: async (_doctor, { id }) => {
      toast.success('Doctor availability updated.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: doctorKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: doctorKeys.current() }),
        queryClient.invalidateQueries({ queryKey: doctorKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: doctorKeys.doctorSlots(id) }),
      ]);
    },
    onError: (error) => toast.error(getDoctorErrorMessage(error)),
  });
}

export function useCreateDoctorLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ doctorId, payload }: { doctorId: string; payload: CreateDoctorLeavePayload }) =>
      doctorsApi.createLeave(doctorId, payload),
    onSuccess: async (_leave, { doctorId }) => {
      toast.success('Doctor leave added.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: doctorKeys.doctorLeaves(doctorId) }),
        queryClient.invalidateQueries({ queryKey: doctorKeys.doctorSlots(doctorId) }),
      ]);
    },
    onError: (error) => toast.error(getDoctorErrorMessage(error)),
  });
}

export function useCancelDoctorLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ doctorId, leaveId }: { doctorId: string; leaveId: string }) =>
      doctorsApi.cancelLeave(doctorId, leaveId),
    onSuccess: async (_leave, { doctorId }) => {
      toast.success('Doctor leave cancelled.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: doctorKeys.doctorLeaves(doctorId) }),
        queryClient.invalidateQueries({ queryKey: doctorKeys.doctorSlots(doctorId) }),
      ]);
    },
    onError: (error) => toast.error(getDoctorErrorMessage(error)),
  });
}

export function useSaveDoctorException() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ doctorId, payload }: { doctorId: string; payload: SaveDoctorExceptionPayload }) =>
      doctorsApi.saveException(doctorId, payload),
    onSuccess: async (_exception, { doctorId }) => {
      toast.success('Doctor availability exception saved.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: doctorKeys.doctorExceptions(doctorId) }),
        queryClient.invalidateQueries({ queryKey: doctorKeys.doctorSlots(doctorId) }),
      ]);
    },
    onError: (error) => toast.error(getDoctorErrorMessage(error)),
  });
}

export function useDeleteDoctorException() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ doctorId, exceptionId }: { doctorId: string; exceptionId: string }) =>
      doctorsApi.deleteException(doctorId, exceptionId),
    onSuccess: async (_result, { doctorId }) => {
      toast.success('Doctor availability exception deleted.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: doctorKeys.doctorExceptions(doctorId) }),
        queryClient.invalidateQueries({ queryKey: doctorKeys.doctorSlots(doctorId) }),
      ]);
    },
    onError: (error) => toast.error(getDoctorErrorMessage(error)),
  });
}
