import { navigate } from '../../routing/navigation';
import { useReceptionReferrals } from './useReception';
export function useReferralBookingFeature() {
  const query = useReceptionReferrals({ page: 1, limit: 100 });
  return { state: { referrals: query.data?.data ?? [], loading: query.isLoading, error: query.error instanceof Error ? query.error.message : '' },
    actions: { openBooking: (visitId: string) => navigate(`/appointments/book?referral_visit=${encodeURIComponent(visitId)}`),
      openPatient: (patientId: string) => navigate(`/patients/profile?id=${encodeURIComponent(patientId)}`) } };
}
