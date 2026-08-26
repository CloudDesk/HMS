import { useDoctorsList, useDoctorAvailableSlots } from '../doctors/useDoctors';
import { usePatientsList, usePatientDetails } from '../patients/usePatients';
import { useCreateAppointment, useAppointmentsList } from './useAppointments';
import type { SaveAppointmentPayload } from '../../api/appointments';
import { useBookReceptionReferral, useReceptionReferral } from '../reception/useReception';
import { useTimezone } from '../../api/useSettings';
import { fromZonedTime } from 'date-fns-tz';

export function useAppointmentBookingFeature(
  initialPatientId: string,
  patientSearch: string,
  selectedDoctorId: string,
  appointmentDate: string,
  referralVisitId = '',
) {
  const referralQuery = useReceptionReferral(referralVisitId, Boolean(referralVisitId));
  const referral = referralQuery.data ?? null;
  const effectivePatientId = initialPatientId || referral?.patient_id || '';
  // 1. Patient Data
  const { data: initialPatientData } = usePatientDetails(effectivePatientId, Boolean(effectivePatientId));
  const { data: patientResultsData, isLoading: patientLoading, refetch: searchPatientsRefetch } = usePatientsList(
    { search: patientSearch.trim(), status: 'ACTIVE', limit: 10, sortBy: 'created_at', sortOrder: 'desc' },
    false
  );

  // 2. Doctor Data
  const { data: doctorData, isLoading: doctorLoading } = useDoctorsList({
    status: 'ACTIVE',
    limit: 100,
    sortBy: 'display_name',
    sortOrder: 'asc'
  });

  const { data: slotsData, isLoading: slotLoading } = useDoctorAvailableSlots(
    selectedDoctorId,
    appointmentDate,
    Boolean(selectedDoctorId && appointmentDate)
  );

  // 3. Appointment Data for Slot Availability Calculation
  const { data: existingApptsData, isLoading: existingApptsLoading } = useAppointmentsList(
    { doctor_id: selectedDoctorId || undefined, date_from: appointmentDate, date_to: appointmentDate, limit: 100 },
    Boolean(selectedDoctorId && appointmentDate)
  );

  const createAppointment = useCreateAppointment();
  const bookReferral = useBookReceptionReferral();
  const timezone = useTimezone();

  const handleCreateAppointment = async (payload: SaveAppointmentPayload) => {
    let utc_datetime: string | undefined;
    if (payload.appointment_date && payload.start_time) {
      const localDateTimeString = `${payload.appointment_date}T${payload.start_time}:00`;
      utc_datetime = fromZonedTime(localDateTimeString, timezone).toISOString();
    }
    
    const finalPayload = { ...payload, utc_datetime };

    if (referral) {
      return bookReferral.mutateAsync({ referralId: referral.id, payload: {
        appointment_date: payload.appointment_date ?? '', start_time: payload.start_time ?? '', utc_datetime,
        duration_minutes: payload.duration_minutes, visit_type: payload.visit_type === 'EMERGENCY' ? 'NEW_CONSULTATION' : payload.visit_type,
        priority: payload.priority, notes: payload.notes,
      } });
    }
    return createAppointment.mutateAsync(finalPayload);
  };

  return {
    state: {
      initialPatientData,
      referral,
      patientResults: patientResultsData?.data || [],
      patientLoading,
      doctors: doctorData?.data || [],
      doctorLoading,
      slotsData,
      slotLoading,
      existingApptsData,
      existingApptsLoading,
      isSubmitting: createAppointment.isPending || bookReferral.isPending,
    },
    actions: {
      searchPatientsRefetch,
      handleCreateAppointment,
    }
  };
}
