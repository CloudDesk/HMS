import { useQuery } from '@tanstack/react-query';
import { doctorsApi, type DoctorListParams } from '../../api/doctors';

export const doctorKeys = {
  all: ['doctors'] as const,
  lists: () => [...doctorKeys.all, 'lists'] as const,
  list: (params: DoctorListParams) => [...doctorKeys.lists(), params] as const,
  slots: () => [...doctorKeys.all, 'slots'] as const,
  availableSlots: (doctorId: string, date: string) => [...doctorKeys.slots(), doctorId, date] as const,
};

export function useDoctorsList(params: DoctorListParams = {}, enabled = true) {
  return useQuery({
    queryKey: doctorKeys.list(params),
    queryFn: () => doctorsApi.list(params),
    enabled,
  });
}

export function useDoctorAvailableSlots(doctorId: string, date: string, enabled = true) {
  return useQuery({
    queryKey: doctorKeys.availableSlots(doctorId, date),
    queryFn: () => doctorsApi.availableSlots(doctorId, date),
    enabled: enabled && Boolean(doctorId) && Boolean(date),
  });
}
