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
    isSuperAdmin || hasPermission(user?.permissions ?? [], { module, screen });
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

  const visitQuery = useOpdVisit(visitId);
  const { data: visitData, isLoading: visitLoading } = visitQuery;
  const { data: vitalsData, isLoading: vitalsLoading } = useOpdLatestVitals(visitId);
  const { data: consultationData, isLoading: consultationLoading } = useOpdConsultation(visitId, !activeTab || activeTab === 'Consultation' || activeTab === 'Diagnosis');
  const { data: prescriptionData, isLoading: prescriptionLoading } = useOpdPrescription(visitId, !activeTab || activeTab === 'Prescription');
  const { data: followUpData, isLoading: followUpLoading } = useOpdFollowUp(visitId, !activeTab || activeTab === 'Follow-up');
  const { data: referralData, isLoading: referralLoading } = useOpdReferral(visitId, !activeTab || activeTab === 'Referral');
  const { data: labOrderData, isLoading: labOrderLoading } = useOpdClinicalOrder(visitId, 'LABORATORY', !activeTab || activeTab === 'Lab Orders');
  const { data: imagingOrderData, isLoading: imagingOrderLoading } = useOpdClinicalOrder(visitId, 'IMAGING', !activeTab || activeTab === 'Imaging Orders');

  const { data: doctorsData, isLoading: doctorsLoading } = useDoctors(
    { limit: 100, sortBy: 'display_name', sortOrder: 'asc' },
    canAccess('Doctors', 'Doctor Directory') && (!activeTab || activeTab === 'Referral' || activeTab === 'Follow-up')
  );
  const { data: medicinesData, isLoading: medicinesLoading } = useMedicines(
    { status: 'ACTIVE', limit: 100 },
    (!activeTab || activeTab === 'Prescription') && (canAccess('Administration', 'Medicines') || canAccess('Pharmacy', 'Medicine Inventory') || canAccess('OPD', 'OPD Prescription'))
  );

  const branchId = visitData?.branch_id || '';
  const { data: inventoryData, isLoading: inventoryLoading } = usePharmacyInventoryList(
    { branch_id: branchId, limit: 100 },
    Boolean(branchId && (!activeTab || activeTab === 'Prescription') && (canAccess('Pharmacy', 'Medicine Inventory') || canAccess('OPD', 'OPD Prescription')))
  );

  const { data: servicesData, isLoading: servicesLoading } = useServices(
    { status: 'ACTIVE', limit: 100 },
    Boolean(visitId && (canAccess('Administration', 'Services') || canAccess('OPD', 'OPD Clinical Orders')))
  );

  const { data: documentsData, isLoading: documentsLoading } = usePatientDocuments(
    visitData?.patient_id ?? null,
    { visit_id: visitId ?? undefined, limit: 100 },
    Boolean(visitData?.patient_id && visitId && canAccess('Patients', 'Patient Documents') && (!activeTab || activeTab === 'Documents'))
  );

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
    visit: visitData ?? null,
    vitals: vitalsData ?? null,
    consultation: consultationData ?? null,
    prescription: prescriptionData ?? null,
    followUp: followUpData ?? null,
    referral: referralData ?? null,
    labOrder: labOrderData ?? null,
    imagingOrder: imagingOrderData ?? null,
    doctors: doctorsData?.data ?? [],
    medicines: medicinesData?.data ?? [],
    inventory: inventoryData?.data ?? [],
    services: servicesData?.data ?? [],
    documents: documentsData?.data ?? [],
    isLoading,
    visitLoading,
    isUpdating: isUpdatingOpd,
    visitError: visitQuery.error,
    refetchVisit: visitQuery.refetch,
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
