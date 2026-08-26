import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { useAppointmentsList } from '../appointments/useAppointments';
import { useBillingInvoices } from '../billing/useBilling';
import { useDoctorsList } from '../doctors/useDoctors';
import { useImagingOrders } from '../imaging/useImaging';
import { useLaboratoryOrders } from '../laboratory/useLaboratory';
import { useOpdVisits } from '../opd/useOpd';
import {
  usePatientDetails,
  usePatientDocuments,
  usePatientHistory,
  usePatientTimeline,
  useUpdatePatient,
  useUploadPatientDocument,
} from './usePatients';
import type { SavePatientPayload, UploadPatientDocumentPayload } from '../../api/patients';

export type PatientProfileTab =
  | 'Overview'
  | 'EMR Timeline'
  | 'Medical History'
  | 'Visits'
  | 'Appointments'
  | 'Prescriptions'
  | 'Lab Results'
  | 'Imaging'
  | 'Documents'
  | 'Billing'
  | 'Consent';

export function usePatientProfileFeature(patientId: string | null, initialTab: PatientProfileTab = 'Overview') {
  const { user } = useAuth();
  
  const isSuperAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const can = (action: string) => isSuperAdmin || hasPermission(user?.permissions ?? [], {
    module: 'Patients', screen: 'Profile', action,
  });

  const canEdit = can('Edit');

  const [activeTab, setActiveTab] = useState<PatientProfileTab>(initialTab);

  // Removed todayDate
  const [timelineFilters, setTimelineFilters] = useState({ from: '', to: '' });
  const [timelinePage, setTimelinePage] = useState({ page: 1, limit: 10 });

  const [visitsFilters, setVisitsFilters] = useState({ date_from: '', date_to: '' });
  const [visitsPage, setVisitsPage] = useState({ page: 1, limit: 10 });

  const [appointmentFilters, setAppointmentFilters] = useState({ date_from: '', date_to: '', doctor_id: '' });
  const [appointmentsPage, setAppointmentsPage] = useState({ page: 1, limit: 10 });

  // Details
  const detailsQuery = usePatientDetails(patientId, Boolean(patientId));

  // Timeline & History
  const timelineQuery = usePatientTimeline(
    patientId,
    { ...timelineFilters, page: timelinePage.page, limit: timelinePage.limit },
    (activeTab === 'EMR Timeline' || activeTab === 'Medical History' || activeTab === 'Overview') && Boolean(patientId)
  );
  const historyQuery = usePatientHistory(patientId, activeTab === 'Medical History' && Boolean(patientId));

  // Visits & Appointments
  const visitsQuery = useOpdVisits(
    { ...visitsFilters, patient_id: patientId || undefined, page: visitsPage.page, limit: visitsPage.limit },
    (activeTab === 'Visits' || activeTab === 'Prescriptions') && Boolean(patientId)
  );

  const appointmentsQuery = useAppointmentsList(
    { ...appointmentFilters, patient_id: patientId || undefined, page: appointmentsPage.page, limit: appointmentsPage.limit, sortBy: 'appointment_date', sortOrder: 'desc' },
    activeTab === 'Appointments' && Boolean(patientId)
  );

  // Labs & Imaging
  const labOrdersQuery = useLaboratoryOrders(
    { patient_id: patientId || undefined, limit: 50 },
    activeTab === 'Lab Results' && Boolean(patientId)
  );

  const imagingOrdersQuery = useImagingOrders(
    { patient_id: patientId || undefined, limit: 50 },
    activeTab === 'Imaging' && Boolean(patientId)
  );

  // Documents
  const documentsQuery = usePatientDocuments(
    patientId,
    { limit: 50 },
    (activeTab === 'Documents' || activeTab === 'Consent') && Boolean(patientId)
  );

  // Billing
  const billingInvoicesQuery = useBillingInvoices(
    { patient_id: patientId || undefined, limit: 50 },
    activeTab === 'Billing' && Boolean(patientId)
  );

  const doctorsQuery = useDoctorsList({ limit: 100, status: 'ACTIVE' }, activeTab === 'Appointments');

  const consents = useMemo(() => {
    return documentsQuery.data?.data.filter((d) => d.document_type === 'CONSENT') || [];
  }, [documentsQuery.data]);

  // Mutations
  const updatePatient = useUpdatePatient();
  const uploadDocument = useUploadPatientDocument();

  const handleUpdateProfile = async (payload: Partial<SavePatientPayload>) => {
    if (!patientId) return;
    await updatePatient.mutateAsync({ id: patientId, payload });
  };

  const handleUploadDocument = async (payload: UploadPatientDocumentPayload) => {
    if (!patientId) return;
    await uploadDocument.mutateAsync({ id: patientId, payload });
  };

  return {
    state: {
      activeTab,
      patient: detailsQuery.data ?? null,
      loadingDetails: detailsQuery.isLoading,
      detailsError: detailsQuery.error,

      timeline: timelineQuery.data?.data ?? [],
      timelineMeta: timelineQuery.data?.meta || { page: 1, limit: 10, totalPages: 1, total: 0 },
      loadingTimeline: timelineQuery.isLoading,

      history: historyQuery.data ?? null,
      loadingHistory: historyQuery.isLoading,

      visits: visitsQuery.data?.data ?? [],
      visitsMeta: visitsQuery.data?.meta || { page: 1, limit: 10, totalPages: 1, total: 0 },
      loadingVisits: visitsQuery.isLoading,

      appointments: appointmentsQuery.data?.data ?? [],
      appointmentsMeta: appointmentsQuery.data?.meta || { page: 1, limit: 10, totalPages: 1, total: 0 },
      loadingAppointments: appointmentsQuery.isLoading,

      labOrders: labOrdersQuery.data?.data ?? [],
      loadingLabOrders: labOrdersQuery.isLoading,

      imagingOrders: imagingOrdersQuery.data?.data ?? [],
      loadingImagingOrders: imagingOrdersQuery.isLoading,

      documents: documentsQuery.data?.data ?? [],
      loadingDocuments: documentsQuery.isLoading,

      consents,

      billingInvoices: billingInvoicesQuery.data?.data ?? [],
      loadingBillingInvoices: billingInvoicesQuery.isLoading,

      doctors: doctorsQuery.data?.data ?? [],

      filters: {
        timeline: timelineFilters,
        visits: visitsFilters,
        appointments: appointmentFilters,
      },

      pageInfo: {
        timeline: timelinePage,
        visits: visitsPage,
        appointments: appointmentsPage,
      },

      isSubmittingUpdate: updatePatient.isPending,
      isSubmittingUpload: uploadDocument.isPending,
    },
    capabilities: {
      canEdit,
    },
    actions: {
      setActiveTab,
      setTimelineFilters,
      setTimelinePage,
      setVisitsFilters,
      setVisitsPage,
      setAppointmentFilters,
      setAppointmentsPage,
      handleUpdateProfile,
      handleUploadDocument,
    },
  };
}
