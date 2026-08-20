import { useDoctorsList, useDoctorAvailableSlots } from '../doctors/useDoctors';
import { usePatientsList, usePatientDetails } from '../patients/usePatients';
import { useCreateAppointment, useAppointmentsList } from './useAppointments';
import type { SaveAppointmentPayload } from '../../api/appointments';

export function useAppointmentBookingFeature(
  initialPatientId: string,
  patientSearch: string,
  selectedDoctorId: string,
  appointmentDate: string
) {
  // 1. Patient Data
  const { data: initialPatientData } = usePatientDetails(initialPatientId, Boolean(initialPatientId));
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

  const handleCreateAppointment = async (payload: SaveAppointmentPayload) => {
    return createAppointment.mutateAsync(payload);
  };

  return {
    state: {
      initialPatientData,
      patientResults: patientResultsData?.data || [],
      patientLoading,
      doctors: doctorData?.data || [],
      doctorLoading,
      slotsData,
      slotLoading,
      existingApptsData,
      existingApptsLoading,
      isSubmitting: createAppointment.isPending,
    },
    actions: {
      searchPatientsRefetch,
      handleCreateAppointment,
    }
  };
}
