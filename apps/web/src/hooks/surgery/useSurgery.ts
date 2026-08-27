import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateBookingPayload, CreateRecommendationPayload, SurgeryListParams } from '../../api/surgery';
import { surgeryService } from '../../services/surgery.service';
const keys = { all: ['surgery'] as const, recommendations: (params?: SurgeryListParams) => ['surgery', 'recommendations', params] as const, bookings: (params?: SurgeryListParams) => ['surgery', 'bookings', params] as const, alternatives: (params: Record<string, string>) => ['surgery', 'alternatives', params] as const };
export function useSurgery(params: SurgeryListParams, enabled: { recommendations: boolean; bookings: boolean }) {
  const client = useQueryClient(); const refresh = () => client.invalidateQueries({ queryKey: keys.all });
  const recommendations = useQuery({ queryKey: keys.recommendations(params), queryFn: () => surgeryService.recommendations(params), enabled: enabled.recommendations });
  const bookings = useQuery({ queryKey: keys.bookings(params), queryFn: () => surgeryService.bookings(params), enabled: enabled.bookings });
  const createRecommendation = useMutation({ mutationFn: (body: CreateRecommendationPayload) => surgeryService.createRecommendation(body), onSuccess: refresh });
  const cancelRecommendation = useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => surgeryService.cancelRecommendation(id, params.branch_id, reason), onSuccess: refresh });
  const createBooking = useMutation({ mutationFn: (body: CreateBookingPayload) => surgeryService.createBooking(body), onSuccess: refresh });
  const confirmBooking = useMutation({ mutationFn: ({ id, body }: { id: string; body: Parameters<typeof surgeryService.confirmBooking>[2] }) => surgeryService.confirmBooking(id, params.branch_id, body), onSuccess: refresh });
  const rescheduleBooking = useMutation({ mutationFn: ({ id, body }: { id: string; body: Parameters<typeof surgeryService.rescheduleBooking>[2] }) => surgeryService.rescheduleBooking(id, params.branch_id, body), onSuccess: refresh });
  const cancelBooking = useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => surgeryService.cancelBooking(id, params.branch_id, reason), onSuccess: refresh });
  const completeBooking = useMutation({ mutationFn: (id: string) => surgeryService.completeBooking(id, params.branch_id), onSuccess: refresh });
  return { recommendations, bookings, createRecommendation, cancelRecommendation, createBooking, confirmBooking, rescheduleBooking, cancelBooking, completeBooking };
}
export function useSurgeryAlternatives(params: { branch_id: string; department_id: string; service_id: string; scheduled_start: string; doctor_id?: string }, enabled: boolean) { return useQuery({ queryKey: keys.alternatives(params), queryFn: () => surgeryService.alternatives(params), enabled }); }
