import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  patientPortalApi,
  type PatientPortalOverview,
  type PortalAppointment,
} from '../api/patient-portal';
import { portalQueryKeys } from '../api/query-keys';
import { navigate, useAppLocation } from '../routing/navigation';

export type PortalTab =
  | 'overview'
  | 'appointments'
  | 'results'
  | 'medicines'
  | 'documents'
  | 'billing'
  | 'profile';

export const tabs: Array<{ key: PortalTab; label: string; icon: string }> = [
  { key: 'overview', label: 'Overview', icon: 'ph-house' },
  { key: 'appointments', label: 'Appointments', icon: 'ph-calendar-blank' },
  { key: 'results', label: 'Reports & results', icon: 'ph-file-text' },
  { key: 'medicines', label: 'Prescriptions', icon: 'ph-prescription' },
  { key: 'documents', label: 'Documents', icon: 'ph-files' },
  { key: 'billing', label: 'Billing', icon: 'ph-receipt' },
  { key: 'profile', label: 'My profile', icon: 'ph-user-circle' },
];

export function usePatientPortal() {
  const { search } = useAppLocation();
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(search);
  const requestedTab = (urlParams.get('tab') as PortalTab) || 'overview';
  const validTabs: PortalTab[] = [
    'overview',
    'appointments',
    'results',
    'medicines',
    'documents',
    'billing',
    'profile',
  ];
  const tab: PortalTab = validTabs.includes(requestedTab) ? requestedTab : 'overview';

  const setTab = (nextTab: PortalTab) => {
    const params = new URLSearchParams(window.location.search);
    if (nextTab === 'overview') {
      params.delete('tab');
    } else {
      params.set('tab', nextTab);
    }
    const qs = params.toString();
    navigate(qs ? `/portal?${qs}` : '/portal');
  };
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [addDependentOpen, setAddDependentOpen] = useState(false);
  const [addSelfOpen, setAddSelfOpen] = useState(false);
  const [editPersonalInformationOpen, setEditPersonalInformationOpen] = useState(false);
  const [patientCardOpen, setPatientCardOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PatientPortalOverview['invoices'][number] | null>(null);

  const bookingParams = new URLSearchParams(search);
  const requestedDoctorId = bookingParams.get('book') || bookingParams.get('doctor_id') || undefined;
  const requestedBranchId = bookingParams.get('branch') || bookingParams.get('branch_id') || undefined;
  const requestedDepartmentId = bookingParams.get('department') || bookingParams.get('department_id') || undefined;
  const [bookingOpen, setBookingOpen] = useState(Boolean(requestedDoctorId || requestedBranchId || requestedDepartmentId));

  const [appointmentScope, setAppointmentScope] = useState<'upcoming' | 'past'>('upcoming');
  const [appointmentStatus, setAppointmentStatus] = useState<PortalAppointment['status'] | ''>('');
  const [appointmentPage, setAppointmentPage] = useState(1);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<PortalAppointment | null>(null);

  useEffect(() => {
    if (requestedDoctorId || requestedBranchId || requestedDepartmentId) {
      setBookingOpen(true);
    }
  }, [requestedDoctorId, requestedBranchId, requestedDepartmentId]);

  const contextQuery = useQuery({
    queryKey: portalQueryKeys.context(),
    queryFn: patientPortalApi.context,
  });

  useEffect(() => {
    const patients = contextQuery.data?.patients;
    const firstPatient = patients?.[0];
    if (patients && patients.length > 0 && firstPatient) {
      const isValid = patients.some((p) => p.id === selectedPatientId);
      if (!selectedPatientId || !isValid) {
        setSelectedPatientId(firstPatient.id);
      }
    }
  }, [contextQuery.data, selectedPatientId]);

  const overviewQuery = useQuery({
    queryKey: portalQueryKeys.overview(selectedPatientId),
    queryFn: () => patientPortalApi.overview(selectedPatientId),
    enabled: Boolean(selectedPatientId),
  });

  const invoiceQuery = useQuery({
    queryKey: portalQueryKeys.invoice(selectedPatientId, selectedInvoice?.id),
    queryFn: () => patientPortalApi.invoice(selectedPatientId, selectedInvoice!.id),
    enabled: Boolean(selectedPatientId && selectedInvoice?.id),
  });

  const appointmentsQuery = useQuery({
    queryKey: portalQueryKeys.appointments({
      patientId: selectedPatientId,
      scope: appointmentScope,
      status: appointmentStatus || undefined,
      page: appointmentPage,
      limit: 10,
    }),
    queryFn: () =>
      patientPortalApi.appointments({
        patientId: selectedPatientId,
        scope: appointmentScope,
        status: appointmentStatus || undefined,
        page: appointmentPage,
        limit: 10,
      }),
    enabled: Boolean(selectedPatientId && tab === 'appointments'),
  });

  useEffect(
    () => setAppointmentPage(1),
    [appointmentScope, appointmentStatus, selectedPatientId]
  );

  const patientSaved = async (patientId: string) => {
    setSelectedPatientId(patientId);
    setAddDependentOpen(false);
    setAddSelfOpen(false);
    await queryClient.invalidateQueries({ queryKey: portalQueryKeys.context() });
    await queryClient.invalidateQueries({
      queryKey: ['patient-portal-overview'],
    });
  };

  const closeBooking = () => {
    setBookingOpen(false);
    const params = new URLSearchParams(window.location.search);
    if (
      params.has('book') ||
      params.has('branch') ||
      params.has('department') ||
      params.has('doctor_id') ||
      params.has('branch_id') ||
      params.has('department_id')
    ) {
      params.delete('book');
      params.delete('branch');
      params.delete('department');
      params.delete('doctor_id');
      params.delete('branch_id');
      params.delete('department_id');
      const qs = params.toString();
      navigate(`/portal${qs ? `?${qs}` : ''}`, { replace: true });
    }
  };

  const personalInformationSaved = async () => {
    setEditPersonalInformationOpen(false);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: portalQueryKeys.context() }),
      queryClient.invalidateQueries({
        queryKey: portalQueryKeys.overview(selectedPatientId),
      }),
    ]);
  };

  return {
    tab,
    setTab,
    selectedPatientId,
    setSelectedPatientId,
    contextQuery,
    overviewQuery,
    invoiceQuery,
    appointmentsQuery,
    appointmentScope,
    setAppointmentScope,
    appointmentStatus,
    setAppointmentStatus,
    appointmentPage,
    setAppointmentPage,
    addDependentOpen,
    setAddDependentOpen,
    addSelfOpen,
    setAddSelfOpen,
    editPersonalInformationOpen,
    setEditPersonalInformationOpen,
    patientCardOpen,
    setPatientCardOpen,
    selectedInvoice,
    setSelectedInvoice,
    bookingOpen,
    setBookingOpen,
    closeBooking,
    requestedDoctorId,
    requestedBranchId,
    requestedDepartmentId,
    rescheduleAppointment,
    setRescheduleAppointment,
    patientSaved,
    personalInformationSaved,
  };
}
