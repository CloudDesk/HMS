import type { EmergencyReferralResponse } from '../../api/emergency';
import type { OpdReferralResponse } from '../../api/opd';
import { navigate } from '../../routing/navigation';
import { useEmergencyReferrals } from '../emergency/useEmergency';
import { useReceptionReferrals } from './useReception';

export type ReferralBookingItem = {
  id: string;
  source_type: 'OPD_VISIT' | 'EMERGENCY_ENCOUNTER';
  source_id: string;
  branch_id: string | null;
  patient_id: string | null;
  patient_number: string;
  patient_name: string;
  referring_doctor_name: string;
  referred_doctor_id: string | null;
  referred_doctor_name: string | null;
  specialty: string;
  priority: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  appointment_id: string | null;
  appointment_number: string | null;
  submitted_at: string | null;
  bookable: boolean;
};

const fromOpd = (item: OpdReferralResponse): ReferralBookingItem => ({
  id: item.id,
  source_type: 'OPD_VISIT',
  source_id: item.visit_id,
  branch_id: item.branch_id,
  patient_id: item.patient_id,
  patient_number: item.patient_number,
  patient_name: item.patient_name,
  referring_doctor_name: item.referring_doctor_name,
  referred_doctor_id: item.referred_doctor_id,
  referred_doctor_name: item.referred_doctor_name,
  specialty: item.specialty ?? item.referral_type ?? 'OPD referral',
  priority: item.priority,
  appointment_id: item.appointment_id,
  appointment_number: item.appointment_number,
  submitted_at: item.submitted_at,
  bookable: item.referral_type === 'INTERNAL' && Boolean(item.referred_doctor_id),
});

const fromEmergency = (item: EmergencyReferralResponse): ReferralBookingItem => ({
  id: item.id,
  source_type: item.source_type,
  source_id: item.source_id,
  branch_id: item.branch_id,
  patient_id: item.patient_id,
  patient_number: item.patient_number,
  patient_name: item.patient_name,
  referring_doctor_name: item.referring_doctor_name,
  referred_doctor_id: item.referred_doctor_id,
  referred_doctor_name: item.referred_doctor_name,
  specialty: item.target_department_name,
  priority: item.priority,
  appointment_id: item.appointment_id,
  appointment_number: item.appointment_number,
  submitted_at: item.submitted_at,
  bookable: Boolean(item.referred_doctor_id && item.patient_id),
});

export function useReferralBookingFeature() {
  const opd = useReceptionReferrals({ page: 1, limit: 100 });
  const emergency = useEmergencyReferrals({ page: 1, limit: 100 });
  const referrals = [
    ...(opd.data?.data ?? []).map(fromOpd),
    ...(emergency.data?.data ?? []).map(fromEmergency),
  ].sort((a, b) => (b.submitted_at ?? '').localeCompare(a.submitted_at ?? ''));
  const error = opd.error ?? emergency.error;
  return {
    state: {
      referrals,
      loading: opd.isLoading || emergency.isLoading,
      error: error instanceof Error ? error.message : '',
    },
    actions: {
      openBooking: (item: ReferralBookingItem) => {
        if (item.source_type === 'EMERGENCY_ENCOUNTER') {
          navigate(`/appointments/book?emergency_referral=${encodeURIComponent(item.source_id)}&branch_id=${encodeURIComponent(item.branch_id ?? '')}`);
          return;
        }
        navigate(`/appointments/book?referral_visit=${encodeURIComponent(item.source_id)}`);
      },
      openPatient: (patientId: string) => navigate(`/patients/profile?id=${encodeURIComponent(patientId)}`),
    },
  };
}
