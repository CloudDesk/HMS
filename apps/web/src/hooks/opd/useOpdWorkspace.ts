import {
  useCompleteOpdConsultation,
  useCreateOpdVitals,
  useOpdClinicalOrder,
  useOpdConsultation,
  useOpdFollowUp,
  useOpdLatestVitals,
  useOpdPrescription,
  useOpdReferral,
  useOpdVisit,
  useSaveOpdConsultationDraft,
  useSaveOpdClinicalOrderDraft,
  useSaveOpdPrescriptionDraft,
  useSaveOpdFollowUpDraft,
  useSaveOpdReferralDraft,
  useScheduleOpdFollowUp,
  useSubmitOpdClinicalOrder,
  useSubmitOpdPrescription,
  useSubmitOpdReferral,
  useUpdateOpdVisitStatus,
} from './useOpd';
import { useDoctorsList as useDoctors } from '../doctors/useDoctors';
import { useMedicinesList as useMedicines } from '../medicines/useMedicines';

import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { usePharmacyInventoryList } from '../pharmacy/usePharmacy';
import { useServicesList as useServices } from '../services/useServices';
import {
  useDeletePatientDocument,
  useDownloadPatientDocument,
  usePatientDocuments,
  useUploadPatientDocument,
} from '../patients/usePatients';
import { useCreateAppointment } from '../appointments/useAppointments';
import { useCreateBillingInvoice } from '../billing/useBilling';

export function useOpdWorkspace(visitId: string | null, activeTab?: string) {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.roles?.some((role) => role.code === 'SUPER_ADMIN'));
  const canAccess = (module: string, screen: string) =>
    isSuperAdmin || hasPermission(user?.permissions ?? [], { module, screen, action: 'View' });
  const canAction = (module: string, screen: string, action: string) =>
    isSuperAdmin || hasPermission(user?.permissions ?? [], { module, screen, action });

  // Capability flags — owned here so OpdVisitPage never traverses permissions directly
  const canEditConsultation = canAction('OPD', 'OPD Consultation', 'Edit');
  const canEditPrescription = canAction('OPD', 'OPD Prescription', 'Edit');
  const canEditClinicalOrders = canAction('OPD', 'OPD Clinical Orders', 'Edit');
  const canEditReferral = canAction('OPD', 'OPD Referral', 'Edit');
  const canEditFollowUp = canAction('OPD', 'OPD Follow-up', 'Edit');
  const canBookAppointments = canAction('Appointments', 'Appointment Booking', 'Create');
  const canCreateDocuments = canAction('Patients', 'Patient Documents', 'Create');
  const canDeleteDocuments = canAction('Patients', 'Patient Documents', 'Delete');
  const canCreateVitals = canAction('OPD', 'OPD Vitals', 'Create');

  const hasVisit = Boolean(visitId);
  const visitQuery = useOpdVisit(visitId, canAccess('OPD', 'OPD Visits'));
  const { data: visitData, isLoading: visitLoading } = visitQuery;
  // Persisted records support the cross-tab summary/save. Gate them by permission, not the active tab.
  const vitalsQuery = useOpdLatestVitals(visitId, canAccess('OPD', 'OPD Vitals'));
  const { data: vitalsData, isLoading: vitalsLoading } = vitalsQuery;
  const consultationQuery = useOpdConsultation(visitId, canAccess('OPD', 'OPD Consultation'));
  const { data: consultationData, isLoading: consultationLoading } = consultationQuery;
  const prescriptionQuery = useOpdPrescription(visitId, canAccess('OPD', 'OPD Prescription'));
  const { data: prescriptionData, isLoading: prescriptionLoading } = prescriptionQuery;
  const followUpQuery = useOpdFollowUp(visitId, canAccess('OPD', 'OPD Follow-up'));
  const { data: followUpData, isLoading: followUpLoading } = followUpQuery;
  const referralQuery = useOpdReferral(visitId, canAccess('OPD', 'OPD Referral'));
  const { data: referralData, isLoading: referralLoading } = referralQuery;
  const labOrderQuery = useOpdClinicalOrder(visitId, 'LABORATORY', canAccess('OPD', 'OPD Clinical Orders'));
  const { data: labOrderData, isLoading: labOrderLoading } = labOrderQuery;
  const imagingOrderQuery = useOpdClinicalOrder(visitId, 'IMAGING', canAccess('OPD', 'OPD Clinical Orders'));
  const { data: imagingOrderData, isLoading: imagingOrderLoading } = imagingOrderQuery;

  const { data: doctorsData, isLoading: doctorsLoading } = useDoctors(
    { limit: 100, sortBy: 'display_name', sortOrder: 'asc' },
    hasVisit && canAccess('Doctors', 'Doctor Directory') && (!activeTab || activeTab === 'Referral' || activeTab === 'Follow-up')
  );
  const { data: medicinesData, isLoading: medicinesLoading } = useMedicines(
    { status: 'ACTIVE', limit: 100 },
    hasVisit && (!activeTab || activeTab === 'Prescription') && canAccess('Administration', 'Medicines')
  );

  const currentVisit = visitData?.id === visitId ? visitData : null;
  const matchesVisit = (record: { visit_id: string; patient_id: string } | null | undefined) =>
    Boolean(currentVisit && record?.visit_id === visitId && record.patient_id === currentVisit.patient_id);
  const branchId = currentVisit?.branch_id || '';
  const { data: inventoryData, isLoading: inventoryLoading } = usePharmacyInventoryList(
    { branch_id: branchId, limit: 100 },
    Boolean(hasVisit && branchId && (!activeTab || activeTab === 'Prescription') && canAccess('Pharmacy', 'Medicine Inventory'))
  );

  const { data: servicesData, isLoading: servicesLoading } = useServices(
    { status: 'ACTIVE', limit: 100 },
    hasVisit && canAccess('Administration', 'Services')
  );

  const { data: documentsData, isLoading: documentsLoading } = usePatientDocuments(
    currentVisit?.patient_id ?? null,
    { visit_id: visitId ?? undefined, limit: 100 },
    Boolean(currentVisit?.patient_id && visitId && canAccess('Patients', 'Patient Documents') && (!activeTab || activeTab === 'Documents'))
  );

  const clinicalQueries = [
    { screen: 'OPD Vitals', query: vitalsQuery },
    { screen: 'OPD Consultation', query: consultationQuery },
    { screen: 'OPD Prescription', query: prescriptionQuery },
    { screen: 'OPD Follow-up', query: followUpQuery },
    { screen: 'OPD Referral', query: referralQuery },
    { screen: 'OPD Clinical Orders', query: labOrderQuery },
    { screen: 'OPD Clinical Orders', query: imagingOrderQuery },
  ].filter((entry) => hasVisit && canAccess('OPD', entry.screen));
  const mismatchedRecord = currentVisit && clinicalQueries.some((entry) => entry.query.data && !matchesVisit(entry.query.data));
  const loadError = visitQuery.error ?? clinicalQueries.find((entry) => entry.query.error)?.query.error
    ?? (mismatchedRecord ? new Error('Encounter records do not match the selected patient. Refresh before continuing.') : null);

  const silentNotifications = { notifyOnError: false, notifyOnSuccess: false };
  const { mutateAsync: saveConsultationDraft, isPending: isSavingConsultation } = useSaveOpdConsultationDraft(silentNotifications);
  const { mutateAsync: completeConsultation, isPending: isCompletingConsultation } = useCompleteOpdConsultation(silentNotifications);
  const { mutateAsync: submitPrescription, isPending: isSubmittingPrescription } = useSubmitOpdPrescription(silentNotifications);
  const { mutateAsync: savePrescriptionDraft, isPending: isSavingPrescription } = useSaveOpdPrescriptionDraft(silentNotifications);
  const { mutateAsync: submitClinicalOrder, isPending: isSubmittingClinicalOrder } = useSubmitOpdClinicalOrder(silentNotifications);
  const { mutateAsync: saveClinicalOrderDraft, isPending: isSavingClinicalOrder } = useSaveOpdClinicalOrderDraft(silentNotifications);
  const { mutateAsync: createVitals, isPending: isCreatingVitals } = useCreateOpdVitals(silentNotifications);
  const { mutateAsync: updateVisitStatus, isPending: isUpdatingVisitStatus } = useUpdateOpdVisitStatus(silentNotifications);
  const { mutateAsync: saveFollowUpDraft, isPending: isSavingFollowUp } = useSaveOpdFollowUpDraft();
  const { mutateAsync: scheduleFollowUp, isPending: isSchedulingFollowUp } = useScheduleOpdFollowUp();
  const { mutateAsync: saveReferralDraft, isPending: isSavingReferral } = useSaveOpdReferralDraft();
  const { mutateAsync: submitReferral, isPending: isSubmittingReferral } = useSubmitOpdReferral(silentNotifications);

  const { mutateAsync: createAppointment, isPending: isCreatingAppointment } = useCreateAppointment();
  const { mutateAsync: uploadDocument, isPending: isUploadingDocument } = useUploadPatientDocument(silentNotifications);
  const { mutateAsync: deleteDocument, isPending: isDeletingDocument } = useDeletePatientDocument(silentNotifications);
  const { mutateAsync: downloadDocument, isPending: isDownloadingDocument } = useDownloadPatientDocument();
  const { mutateAsync: createBillingInvoice, isPending: isCreatingBillingInvoice } = useCreateBillingInvoice(silentNotifications);

  const isLoading =
    visitLoading ||
    vitalsLoading ||
    consultationLoading ||
    prescriptionLoading ||
    followUpLoading ||
    referralLoading ||
    labOrderLoading ||
    imagingOrderLoading ||
    doctorsLoading ||
    medicinesLoading ||
    inventoryLoading ||
    servicesLoading ||
    documentsLoading;

  const isUpdating =
    isSavingConsultation ||
    isCompletingConsultation ||
    isSubmittingPrescription ||
    isSavingPrescription ||
    isSubmittingClinicalOrder ||
    isSavingClinicalOrder ||
    isCreatingVitals ||
    isUpdatingVisitStatus ||
    isCreatingAppointment ||
    isUploadingDocument ||
    isDeletingDocument ||
    isDownloadingDocument ||
    isCreatingBillingInvoice;

  const isUpdatingOpd =
    isUpdating ||
    isSavingFollowUp ||
    isSchedulingFollowUp ||
    isSavingReferral ||
    isSubmittingReferral;

  return {
    visit: canAccess('OPD', 'OPD Visits') && visitData?.id === visitId ? visitData : null,
    vitals: canAccess('OPD', 'OPD Vitals') && matchesVisit(vitalsData) ? vitalsData ?? null : null,
    consultation: canAccess('OPD', 'OPD Consultation') && matchesVisit(consultationData) ? consultationData ?? null : null,
    prescription: canAccess('OPD', 'OPD Prescription') && matchesVisit(prescriptionData) ? prescriptionData ?? null : null,
    followUp: canAccess('OPD', 'OPD Follow-up') && matchesVisit(followUpData) ? followUpData ?? null : null,
    referral: canAccess('OPD', 'OPD Referral') && matchesVisit(referralData) ? referralData ?? null : null,
    labOrder: canAccess('OPD', 'OPD Clinical Orders') && matchesVisit(labOrderData) ? labOrderData ?? null : null,
    imagingOrder: canAccess('OPD', 'OPD Clinical Orders') && matchesVisit(imagingOrderData) ? imagingOrderData ?? null : null,
    doctors: canAccess('Doctors', 'Doctor Directory') ? doctorsData?.data ?? [] : [],
    medicines: canAccess('Administration', 'Medicines') ? medicinesData?.data ?? [] : [],
    inventory: canAccess('Pharmacy', 'Medicine Inventory') ? inventoryData?.data ?? [] : [],
    services: canAccess('Administration', 'Services') ? servicesData?.data ?? [] : [],
    documents: canAccess('Patients', 'Patient Documents') ? documentsData?.data ?? [] : [],
    isLoading,
    visitLoading,
    isUpdating: isUpdatingOpd,
    visitError: loadError,
    refetchVisit: () => Promise.all([
      ...(hasVisit && canAccess('OPD', 'OPD Visits') ? [visitQuery.refetch()] : []),
      ...clinicalQueries.map((entry) => entry.query.refetch()),
    ]),
    isSavingConsultation,
    isCompletingConsultation,
    isSubmittingPrescription,
    isCreatingVitals,
    isUploadingDocument,
    isDeletingDocument,
    isDownloadingDocument,
    isSavingFollowUp,
    isSchedulingFollowUp,
    isSavingReferral,
    isSubmittingReferral,
    mutations: {
      saveConsultationDraft,
      completeConsultation,
      submitPrescription,
      savePrescriptionDraft,
      submitClinicalOrder,
      saveClinicalOrderDraft,
      createVitals,
      updateVisitStatus,
      createAppointment,
      uploadDocument,
      deleteDocument,
      downloadDocument,
      createBillingInvoice,
      saveFollowUpDraft,
      scheduleFollowUp,
      saveReferralDraft,
      submitReferral,
    },
    // Capability flags — pages consume these instead of traversing permissions
    canEditConsultation,
    canEditPrescription,
    canEditClinicalOrders,
    canEditReferral,
    canEditFollowUp,
    canBookAppointments,
    canCreateDocuments,
    canDeleteDocuments,
    canCreateVitals,
  };
}
