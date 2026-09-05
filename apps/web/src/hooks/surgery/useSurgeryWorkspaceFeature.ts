import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useAppLocation } from '../../routing/navigation';
import { useBranchesList } from '../branches/useBranches';
import { useDepartmentsList } from '../departments/useDepartments';
import { useDoctorsList } from '../doctors/useDoctors';
import { usePatientsList } from '../patients/usePatients';
import { useServicesList } from '../services/useServices';
import { useLinkProcedureBillingContext } from '../billing/useBilling';
import { useConsentTemplates } from '../consents/useConsents';
import { useUploadPatientDocument } from '../patients/usePatients';
import { useAdvancePaymentFeature } from '../advance-payment/useAdvancePaymentFeature';
import { fetchSurgeryBooking, useSurgery, useSurgeryAlternatives } from './useSurgery';
import { useSurgeryDownstreamFeature } from './useSurgeryDownstreamFeature';
import { hasPermission } from '../../auth/access-control';
export type SurgeryTab = 'recommendations' | 'bookings' | 'schedule';
const isTab = (value: string | null): value is SurgeryTab => value === 'recommendations' || value === 'bookings' || value === 'schedule';
type SurgeryDomain = ReturnType<typeof useSurgery>;
export type SurgeryWorkflowAction =
  | { mode: 'cancel-recommendation'; variables: Parameters<SurgeryDomain['cancelRecommendation']['mutateAsync']>[0] }
  | { mode: 'confirm'; variables: Parameters<SurgeryDomain['confirmBooking']['mutateAsync']>[0] }
  | { mode: 'reschedule'; variables: Parameters<SurgeryDomain['rescheduleBooking']['mutateAsync']>[0] }
  | { mode: 'cancel-booking'; variables: Parameters<SurgeryDomain['cancelBooking']['mutateAsync']>[0] }
  | { mode: 'complete'; variables: Parameters<SurgeryDomain['completeBooking']['mutateAsync']>[0] };
type SurgeryWorkspaceOptions = {
  consentOpen?: boolean;
  selectedBookingId?: string | null;
  selectedBookingStatus?: string | null;
};
export function useSurgeryWorkspaceFeature({ consentOpen = false, selectedBookingId = null, selectedBookingStatus = null }: SurgeryWorkspaceOptions = {}) {
  const { user } = useAuth(); const { search } = useAppLocation(); const initial = new URLSearchParams(search);
  const permissions = user?.permissions ?? [];

  const canViewRecommendations = hasPermission(permissions, { module: 'SURGERY', screen: 'RECOMMENDATIONS', action: 'VIEW' });
  const canCreateRecommendations = hasPermission(permissions, { module: 'SURGERY', screen: 'RECOMMENDATIONS', action: 'CREATE' });
  const canCancelRecommendations = hasPermission(permissions, { module: 'SURGERY', screen: 'RECOMMENDATIONS', action: 'CANCEL' });

  const canViewBookings = hasPermission(permissions, { module: 'SURGERY', screen: 'BOOKINGS', action: 'VIEW' });
  const canCreateBookings = hasPermission(permissions, { module: 'SURGERY', screen: 'BOOKINGS', action: 'CREATE' });
  const canConfirmBookings = hasPermission(permissions, { module: 'SURGERY', screen: 'BOOKINGS', action: 'CONFIRM' });
  const canRescheduleBookings = hasPermission(permissions, { module: 'SURGERY', screen: 'BOOKINGS', action: 'RESCHEDULE' });
  const canCancelBookings = hasPermission(permissions, { module: 'SURGERY', screen: 'BOOKINGS', action: 'CANCEL' });
  const canCompleteBookings = hasPermission(permissions, { module: 'SURGERY', screen: 'BOOKINGS', action: 'COMPLETE' });

  const canViewSchedule = hasPermission(permissions, { module: 'SURGERY', screen: 'SCHEDULE', action: 'VIEW' });

  const defaultTab: SurgeryTab = canViewRecommendations
    ? 'recommendations'
    : canViewBookings
    ? 'bookings'
    : canViewSchedule
    ? 'schedule'
    : 'recommendations';

  const initialTab = initial.get('tab');
  const [tab, setTab] = useState<SurgeryTab>(isTab(initialTab) ? initialTab : defaultTab);
  const [branchId, setBranchId] = useState(initial.get('branch_id') ?? ''); const [status, setStatus] = useState(initial.get('status') ?? ''); const [date, setDate] = useState(initial.get('date') ?? new Date().toISOString().slice(0, 10)); const [searchText, setSearchText] = useState(initial.get('search') ?? ''); const [patientSearch, setPatientSearch] = useState('');
  const [availability, setAvailability] = useState<{ department_id: string; service_id: string; scheduled_start: string; doctor_id?: string }>({ department_id: '', service_id: '', scheduled_start: '', doctor_id: '' });
  const isSuperAdmin = user?.roles.some((role) => role.code === 'SUPER_ADMIN') ?? false;
  const branchQuery = useBranchesList({ status: 'ACTIVE', page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' }, isSuperAdmin); const branches = isSuperAdmin ? (branchQuery.data?.data ?? []) : (user?.branches ?? []);
  useEffect(() => {
    if (!branchId && branches.length > 0) {
      const main = branches.find((b) => b.code?.toUpperCase() === 'MB01' || b.name?.toLowerCase().includes('main'));
      setBranchId(main ? main.id : (branches[0]?.id ?? ''));
    }
  }, [branchId, branches]);
  const from = tab === 'schedule' ? new Date(`${date}T00:00:00`).toISOString() : undefined;
  const to = tab === 'schedule' ? new Date(`${date}T23:59:59`).toISOString() : undefined;
  const surgery = useSurgery(
    { branch_id: branchId, status: status || undefined, search: searchText || undefined, from, to, page: 1, limit: 100 },
    { recommendations: Boolean(branchId), bookings: Boolean(branchId) },
  );
  const advancePayment = useAdvancePaymentFeature('PROCEDURE_BOOKING', selectedBookingId);
  const downstream = useSurgeryDownstreamFeature(
    selectedBookingId,
    branchId,
    Boolean(selectedBookingId && selectedBookingStatus && ['PENDING_CONFIRMATION', 'BOOKED'].includes(selectedBookingStatus)),
  );
  const departments = useDepartmentsList({ branch_id: branchId || undefined, status: 'ACTIVE', isClinical: true, page: 1, limit: 100 }, Boolean(branchId));
  const doctors = useDoctorsList({ branch_id: branchId || undefined, status: 'ACTIVE', page: 1, limit: 100 }, Boolean(branchId));
  const services = useServicesList({ status: 'ACTIVE', service_type: 'PROCEDURE', page: 1, limit: 100 });
  const patients = usePatientsList({ search: patientSearch, status: 'ACTIVE', page: 1, limit: 20 }, patientSearch.trim().length >= 2);
  const alternatives = useSurgeryAlternatives({ branch_id: branchId, ...availability }, Boolean(branchId && availability.department_id && availability.service_id && availability.scheduled_start));
  const consentTemplates = useConsentTemplates({ branch_id: branchId, context_type: 'PROCEDURE', status: 'ACTIVE' }, consentOpen);
  const uploadConsent = useUploadPatientDocument();
  const linkProcedureBillingContext = useLinkProcedureBillingContext();
  const linkDeposit = async (booking: { id: string; patient_id: string }, invoiceId?: string | null) => {
    if (!invoiceId) return;
    await linkProcedureBillingContext.mutateAsync({ id: invoiceId, payload: { patient_id: booking.patient_id, branch_id: branchId, booking_id: booking.id } });
  };
  const scheduleRows = useMemo(() => (surgery.bookings.data?.data ?? []).sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start)), [surgery.bookings.data]);
  const availableDoctors = alternatives.data?.available_doctors ?? [];
  const recommendedSlots = alternatives.data?.recommended_slots ?? [];
  const executeWorkflowAction = (action: SurgeryWorkflowAction) => {
    switch (action.mode) {
      case 'cancel-recommendation':
        return surgery.cancelRecommendation.mutateAsync(action.variables);
      case 'confirm':
        return surgery.confirmBooking.mutateAsync(action.variables);
      case 'reschedule':
        if (action.variables.body.reason.trim().length < 3) throw new Error('Reschedule reason is required.');
        return surgery.rescheduleBooking.mutateAsync(action.variables);
      case 'cancel-booking':
        if (action.variables.reason.trim().length < 3) throw new Error('Cancellation reason is required.');
        return surgery.cancelBooking.mutateAsync(action.variables);
      case 'complete':
        return surgery.completeBooking.mutateAsync(action.variables);
    }
  };
  return {
    state: {
      tab, branchId, status, date, searchText, patientSearch, branches, isSuperAdmin,
      departments: departments.data?.data ?? [], doctors: doctors.data?.data ?? [],
      services: services.data?.data ?? [], patients: patients.data?.data ?? [],
      recommendations: surgery.recommendations.data?.data ?? [], bookings: surgery.bookings.data?.data ?? [],
      scheduleRows, recommendationsQuery: surgery.recommendations, bookingsQuery: surgery.bookings,
      alternatives: availableDoctors, recommendedSlots, alternativesLoading: alternatives.isFetching,
      advancePayment, downstream, consentTemplatesQuery: consentTemplates,
      loading: surgery.recommendations.isLoading || surgery.bookings.isLoading,
      error: surgery.recommendations.error ?? surgery.bookings.error,
      capabilities: {
        viewRecommendations: canViewRecommendations,
        createRecommendations: canCreateRecommendations,
        cancelRecommendations: canCancelRecommendations,
        viewBookings: canViewBookings,
        createBookings: canCreateBookings,
        confirmBookings: canConfirmBookings,
        rescheduleBookings: canRescheduleBookings,
        cancelBookings: canCancelBookings,
        completeBookings: canCompleteBookings,
        viewSchedule: canViewSchedule,
      },
      pending: {
        createRecommendation: surgery.createRecommendation.isPending,
        createBooking: surgery.createBooking.isPending,
        workflowAction:
          surgery.cancelRecommendation.isPending || surgery.confirmBooking.isPending ||
          surgery.rescheduleBooking.isPending || surgery.cancelBooking.isPending || surgery.completeBooking.isPending,
        uploadConsent: uploadConsent.isPending,
        linkDeposit: linkProcedureBillingContext.isPending,
      },
    },
    actions: {
      setTab, setBranchId, setStatus, setDate, setSearchText, setPatientSearch, setAvailability,
      createRecommendation: surgery.createRecommendation.mutateAsync,
      createBooking: surgery.createBooking.mutateAsync,
      executeWorkflowAction,
      cancelRecommendation: (id: string, payload: { reason: string }) =>
        surgery.cancelRecommendation.mutateAsync({ id, reason: payload.reason }),
      confirmBooking: (id: string, payload: { hold_id?: string; consent_document_id?: string; deposit_invoice_id?: string }) =>
        surgery.confirmBooking.mutateAsync({ id, body: payload }),
      rescheduleBooking: (id: string, payload: { scheduled_start: string; doctor_id?: string; reason: string }) =>
        surgery.rescheduleBooking.mutateAsync({ id, body: payload }),
      cancelBooking: (id: string, payload: { reason: string }) =>
        surgery.cancelBooking.mutateAsync({ id, reason: payload.reason }),
      completeBooking: (id: string) =>
        surgery.completeBooking.mutateAsync(id),
      uploadConsent: uploadConsent.mutateAsync,
      linkDeposit,
      fetchBookingDetails: (id: string) => fetchSurgeryBooking(id, branchId),
    },
  };
}
