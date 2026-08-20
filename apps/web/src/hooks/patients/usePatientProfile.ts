import { useMemo } from 'react';
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
} from './usePatients';
import type { PatientTimelineListParams, PatientDocumentListParams } from '../../api/patients';
import type { OpdVisitListParams } from '../../api/opd';
import type { AppointmentListParams } from '../../api/appointments';
import type { DiagnosticListParams } from '../../api/laboratory';
import type { BillingInvoiceListParams } from '../../api/billing';

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

export type PatientProfileFilters = {
  timeline: PatientTimelineListParams;
  visits: OpdVisitListParams;
  appointments: AppointmentListParams;
  documents: PatientDocumentListParams;
  lab: DiagnosticListParams;
  imaging: DiagnosticListParams;
  billing: BillingInvoiceListParams;
};

export function usePatientProfile(patientId: string | null, activeTab: PatientProfileTab, filters: PatientProfileFilters) {
  // Always fetch details for the hero banner, if patientId exists
  const detailsQuery = usePatientDetails(patientId, Boolean(patientId));

  // Timeline Tab
  const timelineQuery = usePatientTimeline(
    patientId,
    filters.timeline,
    activeTab === 'EMR Timeline' && Boolean(patientId)
  );

  // History Tab
  const historyQuery = usePatientHistory(patientId, activeTab === 'Medical History' && Boolean(patientId));

  // Visits Tab & Prescriptions Tab
  const visitsQuery = useOpdVisits(
    { ...filters.visits, patient_id: patientId || undefined },
    (activeTab === 'Visits' || activeTab === 'Prescriptions') && Boolean(patientId)
  );

  // Note: For prescriptions, the current implementation iterates over visits to get prescriptions.
  // We'll expose a helper or just return visits, and the component will handle fetching specific prescriptions if needed.

  // Appointments Tab
  const appointmentsQuery = useAppointmentsList(
    { ...filters.appointments, patient_id: patientId || undefined },
    activeTab === 'Appointments' && Boolean(patientId)
  );

  // Lab Results Tab
  const labOrdersQuery = useLaboratoryOrders(
    { ...filters.lab, patient_id: patientId || undefined },
    activeTab === 'Lab Results' && Boolean(patientId)
  );

  // Imaging Tab
  const imagingOrdersQuery = useImagingOrders(
    { ...filters.imaging, patient_id: patientId || undefined },
    activeTab === 'Imaging' && Boolean(patientId)
  );

  // Documents Tab (All clinical/identity docs)
  const documentsQuery = usePatientDocuments(
    patientId,
    filters.documents,
    (activeTab === 'Documents' || activeTab === 'Consent') && Boolean(patientId)
  );

  // Billing Tab
  const billingInvoicesQuery = useBillingInvoices(
    { ...filters.billing, patient_id: patientId || undefined },
    activeTab === 'Billing' && Boolean(patientId)
  );

  // We might need doctors list for rendering doctor names in appointments if they aren't fully hydrated
  const doctorsQuery = useDoctorsList({ limit: 100, status: 'ACTIVE' }, activeTab === 'Appointments');

  const consents = useMemo(() => {
    return documentsQuery.data?.data.filter((d) => d.document_type === 'CONSENT') || [];
  }, [documentsQuery.data]);

  return {
    patient: detailsQuery.data ?? null,
    loadingDetails: detailsQuery.isLoading,
    detailsError: detailsQuery.error,

    timeline: timelineQuery.data?.data ?? [],
    timelineMeta: timelineQuery.data?.meta,
    loadingTimeline: timelineQuery.isLoading,

    history: historyQuery.data ?? null,
    loadingHistory: historyQuery.isLoading,

    visits: visitsQuery.data?.data ?? [],
    visitsMeta: visitsQuery.data?.meta,
    loadingVisits: visitsQuery.isLoading,

    appointments: appointmentsQuery.data?.data ?? [],
    appointmentsMeta: appointmentsQuery.data?.meta,
    loadingAppointments: appointmentsQuery.isLoading,

    labOrders: labOrdersQuery.data?.data ?? [],
    labOrdersMeta: labOrdersQuery.data?.meta,
    loadingLabOrders: labOrdersQuery.isLoading,

    imagingOrders: imagingOrdersQuery.data?.data ?? [],
    imagingOrdersMeta: imagingOrdersQuery.data?.meta,
    loadingImagingOrders: imagingOrdersQuery.isLoading,

    documents: documentsQuery.data?.data ?? [],
    documentsMeta: documentsQuery.data?.meta,
    loadingDocuments: documentsQuery.isLoading,

    consents,

    billingInvoices: billingInvoicesQuery.data?.data ?? [],
    billingInvoicesMeta: billingInvoicesQuery.data?.meta,
    loadingBillingInvoices: billingInvoicesQuery.isLoading,

    doctors: doctorsQuery.data?.data ?? [],
  };
}
