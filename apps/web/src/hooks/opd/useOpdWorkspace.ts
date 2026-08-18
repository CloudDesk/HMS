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
import { pharmacyInventoryApi } from '../../api/pharmacy-inventory';
import { useQuery } from '@tanstack/react-query';
import { useServicesList as useServices } from '../services/useServices';
import {
  useDeletePatientDocument,
  useDownloadPatientDocument,
  usePatientDocuments,
  usePatientsList as usePatients,
  useUploadPatientDocument,
} from '../patients/usePatients';
import { useCreateAppointment } from '../appointments/useAppointments';
import { useCreateBillingInvoice } from '../billing/useBilling';

export function useOpdWorkspace(visitId: string | null) {
  const { data: visitData, isLoading: visitLoading } = useOpdVisit(visitId);
  const { data: vitalsData, isLoading: vitalsLoading } = useOpdLatestVitals(visitId);
  const { data: consultationData, isLoading: consultationLoading } = useOpdConsultation(visitId);
  const { data: prescriptionData, isLoading: prescriptionLoading } = useOpdPrescription(visitId);
  const { data: followUpData, isLoading: followUpLoading } = useOpdFollowUp(visitId);
  const { data: referralData, isLoading: referralLoading } = useOpdReferral(visitId);
  const { data: labOrderData, isLoading: labOrderLoading } = useOpdClinicalOrder(visitId, 'LABORATORY');
  const { data: imagingOrderData, isLoading: imagingOrderLoading } = useOpdClinicalOrder(visitId, 'IMAGING');

  const { data: doctorsData, isLoading: doctorsLoading } = useDoctors({ limit: 100, sortBy: 'display_name', sortOrder: 'asc' });
  const { data: medicinesData, isLoading: medicinesLoading } = useMedicines({ status: 'ACTIVE', limit: 100 });

  const branchId = visitData?.branch_id || '';
  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({ queryKey: ['pharmacyInventory', branchId], queryFn: () => pharmacyInventoryApi.list({ branch_id: branchId, limit: 100 }), enabled: Boolean(branchId) }); // { branch_id: branchId, limit: 100 }, Boolean(branchId));
  const { data: servicesData, isLoading: servicesLoading } = useServices({ status: 'ACTIVE', limit: 100 });
  const { data: patientsData, isLoading: patientsLoading } = usePatients({ status: 'ACTIVE', limit: 100 });
  const { data: documentsData, isLoading: documentsLoading } = usePatientDocuments(
    visitData?.patient_id ?? null,
    { visit_id: visitId ?? undefined, limit: 100 },
    Boolean(visitData?.patient_id && visitId),
  );

  const { mutateAsync: saveConsultationDraft, isPending: isSavingConsultation } = useSaveOpdConsultationDraft();
  const { mutateAsync: completeConsultation, isPending: isCompletingConsultation } = useCompleteOpdConsultation();
  const { mutateAsync: submitPrescription, isPending: isSubmittingPrescription } = useSubmitOpdPrescription();
  const { mutateAsync: submitClinicalOrder, isPending: isSubmittingClinicalOrder } = useSubmitOpdClinicalOrder();
  const { mutateAsync: createVitals, isPending: isCreatingVitals } = useCreateOpdVitals();
  const { mutateAsync: updateVisitStatus, isPending: isUpdatingVisitStatus } = useUpdateOpdVisitStatus();
  const { mutateAsync: saveFollowUpDraft, isPending: isSavingFollowUp } = useSaveOpdFollowUpDraft();
  const { mutateAsync: scheduleFollowUp, isPending: isSchedulingFollowUp } = useScheduleOpdFollowUp();
  const { mutateAsync: saveReferralDraft, isPending: isSavingReferral } = useSaveOpdReferralDraft();
  const { mutateAsync: submitReferral, isPending: isSubmittingReferral } = useSubmitOpdReferral();

  const { mutateAsync: createAppointment, isPending: isCreatingAppointment } = useCreateAppointment();
  const { mutateAsync: uploadDocument, isPending: isUploadingDocument } = useUploadPatientDocument();
  const { mutateAsync: deleteDocument, isPending: isDeletingDocument } = useDeletePatientDocument();
  const { mutateAsync: downloadDocument, isPending: isDownloadingDocument } = useDownloadPatientDocument();
  const { mutateAsync: createBillingInvoice, isPending: isCreatingBillingInvoice } = useCreateBillingInvoice();

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
    patientsLoading ||
    documentsLoading;

  const isUpdating =
    isSavingConsultation ||
    isCompletingConsultation ||
    isSubmittingPrescription ||
    isSubmittingClinicalOrder ||
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
    patients: patientsData?.data ?? [],
    documents: documentsData?.data ?? [],
    isLoading,
    isUpdating: isUpdatingOpd,
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
      submitClinicalOrder,
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
  };
}
