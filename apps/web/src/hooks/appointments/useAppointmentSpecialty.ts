import { useQuery } from '@tanstack/react-query';
import { appointmentSpecialtyService } from '../../services/appointment-specialty.service';
import type { AppointmentSpecialtyQuery } from '../../api/appointments-ophthalmology';
export function useAppointmentSpecialtyOptions(query: AppointmentSpecialtyQuery | null, enabled: boolean) {
  return useQuery({ queryKey: ['appointments', 'ophthalmology-options', query], queryFn: ({ signal }) => { if (!query) throw new Error('Select a consultant and valid options page'); return appointmentSpecialtyService.options(query, signal); }, enabled: enabled && Boolean(query), retry: false });
}
