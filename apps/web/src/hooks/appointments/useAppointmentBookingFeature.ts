import { useDepartmentsList } from '../departments/useDepartments';
import { useAuth } from '../../auth/useAuth';
import { hasPermission, isSuperAdministrator } from '../../auth/access-control';
import { useDoctorsList, useDoctorAvailableSlots } from '../doctors/useDoctors';
import { usePatientsList, usePatientDetails } from '../patients/usePatients';
import { useCreateAppointment, useAppointmentsList } from './useAppointments';
import type { SaveAppointmentPayload } from '../../api/appointments';
import { useBookReceptionReferral, useReceptionReferral } from '../reception/useReception';
import { useBookEmergencyReferral, useEmergencyReferral } from '../emergency/useEmergency';
import { useTimezone } from '../../api/useSettings';
import { fromZonedTime } from 'date-fns-tz';
import { useQueryClient } from '@tanstack/react-query';
import { appointmentsKeys } from './useAppointments';

export function useAppointmentBookingFeature(
  initialPatientId: string,
  patientSearch: string,
  selectedDoctorId: string,
  appointmentDate: string,
  referralVisitId = '',
  emergencyReferralId = '',
  emergencyBranchId = '',
  specialtyOptions: { open: boolean; page: number } = { open: false, page: 1 },
) {
  const { user } = useAuth();
  const canSpecialty = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN')) || hasPermission(user?.permissions ?? [], { module: 'Appointments', screen: 'Appointment Booking', action: 'Create' });
  const lookup = appointmentSpecialtyQuerySchema.safeParse({ doctor_id: selectedDoctorId, resource: 'SERVICES', page: specialtyOptions.page, limit: 20 });
  const specialtyServices = useAppointmentSpecialtyOptions(lookup.success ? lookup.data : null, canSpecialty && specialtyOptions.open);
  const specialtyChoices = useAppointmentSpecialtyOptions(lookup.success ? { ...lookup.data, resource: 'SUB_SPECIALITIES' } : null, canSpecialty && specialtyOptions.open);
  const specialtyReady = canSpecialty && Boolean(specialtyServices.isSuccess && !specialtyServices.isError && !specialtyServices.isFetching && specialtyServices.data?.doctor_id === selectedDoctorId && specialtyServices.data.eligible && specialtyChoices.isSuccess && !specialtyChoices.isError && !specialtyChoices.isFetching && specialtyChoices.data?.doctor_id === selectedDoctorId && specialtyChoices.data.eligible);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canViewDepartments = isSuperAdministrator(user?.roles ?? []) || hasPermission(
    user?.permissions ?? [], { module: 'Administration', screen: 'Departments', action: 'View' },
  );
  const { data: departmentData } = useDepartmentsList({ status: 'ACTIVE', limit: 100 }, canViewDepartments);
  const referralQuery = useReceptionReferral(referralVisitId, Boolean(referralVisitId));
  const emergencyReferralQuery = useEmergencyReferral(
    emergencyReferralId,
    emergencyBranchId,
    Boolean(emergencyReferralId && emergencyBranchId),
  );
  const referral = referralQuery.data ?? emergencyReferralQuery.data ?? null;
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
  const bookEmergencyReferral = useBookEmergencyReferral();
  const timezone = useTimezone();

  const handleCreateAppointment = async (payload: SaveAppointmentPayload) => {
    let utc_datetime: string | undefined;
    if (payload.appointment_date && payload.start_time) {
      const localDateTimeString = `${payload.appointment_date}T${payload.start_time}:00`;
      utc_datetime = fromZonedTime(localDateTimeString, timezone).toISOString();
    }
    
    if (payload.ophthalmology && !specialtyReady) throw new Error('Refresh the specialty options for the selected consultant before saving.');
    if (payload.ophthalmology && (emergencyReferralQuery.data || referralQuery.data) && payload.visit_type === 'EMERGENCY') throw new Error('Use the Emergency workflow for emergency care; choose a consultation or review type for referral booking.');
    const finalPayload = { ...payload, utc_datetime };

    if (emergencyReferralQuery.data) {
      const result = await bookEmergencyReferral.mutateAsync({
        id: emergencyReferralQuery.data.id,
        branchId: emergencyReferralQuery.data.branch_id,
        body: {
          appointment_date: payload.appointment_date ?? '',
          start_time: payload.start_time ?? '',
          utc_datetime: utc_datetime ?? '',
          duration_minutes: payload.duration_minutes,
          visit_type: payload.visit_type === 'EMERGENCY' ? 'NEW_CONSULTATION' : payload.visit_type,
          priority: payload.priority,
          ophthalmology: payload.ophthalmology,
          notes: payload.notes,
        },
      });
      await queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() });
      return result;
    }
    if (referralQuery.data) {
      return bookReferral.mutateAsync({ referralId: referralQuery.data.id, payload: {
        appointment_date: payload.appointment_date ?? '', start_time: payload.start_time ?? '', utc_datetime,
        duration_minutes: payload.duration_minutes, visit_type: payload.visit_type === 'EMERGENCY' ? 'NEW_CONSULTATION' : payload.visit_type,
        priority: payload.priority, notes: payload.notes, ophthalmology: payload.ophthalmology,
      } });
    }
    return createAppointment.mutateAsync(finalPayload);
  };

  return {
    state: {
      departments: departmentData?.data ?? [],
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
      isSubmitting: createAppointment.isPending || bookReferral.isPending || bookEmergencyReferral.isPending,
    },
    actions: {
      searchPatientsRefetch,
      handleCreateAppointment,
    }
  };
}
