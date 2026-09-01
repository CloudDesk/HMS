import { useEffect, useMemo, useState } from 'react';
import type { CreateBillingInvoicePayload } from '../../api/billing';
import type { InventoryItem } from '../../api/pharmacy-inventory';
import type {
  ApiClinicalOrderType,
  SaveOpdClinicalOrderPayload,
  SaveOpdConsultationPayload,
  SaveOpdPrescriptionPayload,
  SaveOpdReferralPayload,
} from '../../api/opd';
import type { UploadPatientDocumentPayload } from '../../api/patients';
import { navigate, useAppLocation } from '../../routing/navigation';
import { useBranchesList } from '../branches/useBranches';
import { useDepartmentsList } from '../departments/useDepartments';
import { usePatientDetails } from '../patients/usePatients';
import { getOpdErrorMessage } from '../../pages/opd-utils';
import { useCallNextOpdPatient, useOpdVisits } from './useOpd';
import { useOpdWorkspace } from './useOpdWorkspace';

const WORKSPACE_TABS = [
  { id: '1', label: '1 Consultation', name: 'Consultation' },
  { id: '2', label: '2 Diagnosis', name: 'Diagnosis' },
  { id: '3', label: '3 Prescription', name: 'Prescription' },
  { id: '4', label: '4 Lab Orders', name: 'Lab Orders' },
  { id: '5', label: '5 Imaging Orders', name: 'Imaging Orders' },
  { id: '6', label: '6 Referral', name: 'Referral' },
  { id: '7', label: '7 Follow-up', name: 'Follow-up' },
] as const;

type SaveWorkspaceDraftInput = {
  consultation: SaveOpdConsultationPayload;
  prescription?: SaveOpdPrescriptionPayload;
  laboratory?: SaveOpdClinicalOrderPayload;
  imaging?: SaveOpdClinicalOrderPayload;
  referral?: SaveOpdReferralPayload;
};

type CompleteWorkspaceInput = SaveWorkspaceDraftInput & {
  invoice?: CreateBillingInvoicePayload;
};

export function useOpdVisitFeature() {
  const { search } = useAppLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const visitIdParam = searchParams.get('id') ?? '';
  const initialTabParam = searchParams.get('tab') ?? 'Consultation';
  const [activeVisitId, setActiveVisitId] = useState(visitIdParam);
  const [activeTab, setActiveTab] = useState<string>(() => {
    const match = WORKSPACE_TABS.find((tab) =>
      tab.name.toLowerCase() === initialTabParam.toLowerCase() ||
      tab.id === initialTabParam ||
      tab.label.toLowerCase().includes(initialTabParam.toLowerCase()));
    return match?.name ?? 'Consultation';
  });

  const recentVisitsQuery = useOpdVisits({ limit: 10, sortBy: 'created_at', sortOrder: 'desc' });
  const recentVisits = recentVisitsQuery.data?.data ?? [];

  useEffect(() => {
    if (visitIdParam && visitIdParam !== activeVisitId) setActiveVisitId(visitIdParam);
  }, [activeVisitId, visitIdParam]);

  useEffect(() => {
    const firstVisit = recentVisits[0];
    if (!activeVisitId && firstVisit) setActiveVisitId(firstVisit.id);
  }, [activeVisitId, recentVisits]);

  const workspace = useOpdWorkspace(activeVisitId || null);
  const patientQuery = usePatientDetails(workspace.visit?.patient_id ?? null);
  const branchesQuery = useBranchesList({ status: 'ACTIVE', limit: 100 }, Boolean(activeVisitId));
  const departmentsQuery = useDepartmentsList({ status: 'ACTIVE', limit: 100 }, Boolean(activeVisitId));
  const callNextPatient = useCallNextOpdPatient({ notifyOnError: false });

  const masterMedicines = useMemo(() => {
    const inventoryById: Record<string, InventoryItem> = {};
    const inventoryByName: Record<string, InventoryItem> = {};
    workspace.inventory.forEach((item) => {
      inventoryById[item.medicine_id] = item;
      if (item.medicine?.name) inventoryByName[item.medicine.name] = item;
    });
    return workspace.medicines.map((medicine) => {
      const inventory = inventoryById[medicine.id] ?? inventoryByName[medicine.name];
      return {
        id: medicine.id,
        name: medicine.name,
        generic_name: medicine.generic_name,
        strength: medicine.strength,
        dosage_form: medicine.dosage_form,
        unit: inventory?.medicine?.name || medicine.unit || 'units',
        available_quantity: inventory?.available_quantity ?? 120,
      };
    });
  }, [workspace.inventory, workspace.medicines]);

  const saveWorkspaceDraft = async (input: SaveWorkspaceDraftInput) => {
    if (!workspace.visit) return;
    const visitId = workspace.visit.id;
    await workspace.mutations.saveConsultationDraft({ visitId, payload: input.consultation });
    if (input.prescription) {
      await workspace.mutations.savePrescriptionDraft({ visitId, payload: input.prescription }).catch(() => null);
    }
    if (input.laboratory) {
      await workspace.mutations.saveClinicalOrderDraft({ visitId, type: 'LABORATORY', payload: input.laboratory }).catch(() => null);
    }
    if (input.imaging) {
      await workspace.mutations.saveClinicalOrderDraft({ visitId, type: 'IMAGING', payload: input.imaging }).catch(() => null);
    }
    if (input.referral) {
      await workspace.mutations.saveReferralDraft({ visitId, payload: input.referral }).catch(() => null);
    }
  };

  const completeWorkspace = async (input: CompleteWorkspaceInput) => {
    if (!workspace.visit) return;
    const visitId = workspace.visit.id;
    await workspace.mutations.completeConsultation({ visitId, payload: input.consultation });
    if (input.prescription) {
      await workspace.mutations.submitPrescription({ visitId, payload: input.prescription });
    }
    if (input.laboratory) {
      await workspace.mutations.submitClinicalOrder({ visitId, type: 'LABORATORY', payload: input.laboratory });
    }
    if (input.imaging) {
      await workspace.mutations.submitClinicalOrder({ visitId, type: 'IMAGING', payload: input.imaging });
    }
    if (input.referral) {
      await workspace.mutations.submitReferral({ visitId, payload: input.referral }).catch(() => null);
    }
    if (input.invoice) {
      await workspace.mutations.createBillingInvoice(input.invoice).catch(() => null);
    }
    if (workspace.visit.status !== 'COMPLETED') {
      await workspace.mutations.updateVisitStatus({
        id: visitId,
        payload: { status: 'COMPLETED', notes: 'Consultation completed.' },
      }).catch(() => null);
    }
    await workspace.refetchVisit();
  };

  const selectVisit = (visitId: string) => {
    setActiveVisitId(visitId);
    navigate(`/opd/consultation?id=${encodeURIComponent(visitId)}`);
  };

  const refetchVisit = async () => {
    await Promise.all([workspace.refetchVisit(), patientQuery.refetch()]);
  };

  return {
    state: {
      activeVisitId,
      activeTab,
      recentVisits,
      visit: workspace.visit,
      patient: patientQuery.data ?? null,
      vitals: workspace.vitals,
      consultation: workspace.consultation,
      prescription: workspace.prescription,
      laboratoryOrder: workspace.labOrder,
      imagingOrder: workspace.imagingOrder,
      doctors: workspace.doctors,
      masterMedicines,
      services: workspace.services,
      branches: branchesQuery.data?.data ?? [],
      departments: departmentsQuery.data?.data ?? [],
      documents: workspace.documents,
      loading: recentVisitsQuery.isLoading || workspace.visitLoading || patientQuery.isLoading,
      loadError: workspace.visitError ? getOpdErrorMessage(workspace.visitError) : '',
      updating: workspace.isUpdating || callNextPatient.isPending,
    },
    actions: {
      setActiveTab,
      selectVisit,
      refetchVisit,
      createVitals: workspace.mutations.createVitals,
      submitReferral: workspace.mutations.submitReferral,
      saveWorkspaceDraft,
      submitPrescription: workspace.mutations.submitPrescription,
      submitClinicalOrder: (
        type: ApiClinicalOrderType,
        payload: SaveOpdClinicalOrderPayload,
      ) => workspace.mutations.submitClinicalOrder({ visitId: workspace.visit?.id ?? '', type, payload }),
      completeWorkspace,
      uploadDocument: (patientId: string, payload: UploadPatientDocumentPayload) =>
        workspace.mutations.uploadDocument({ id: patientId, payload }),
      downloadDocument: (patientId: string, documentId: string) =>
        workspace.mutations.downloadDocument({ patientId, docId: documentId }),
      deleteDocument: (patientId: string, documentId: string) =>
        workspace.mutations.deleteDocument({ id: patientId, documentId }),
      callNextPatient: (visitId: string) => callNextPatient.mutateAsync(visitId),
    },
  };
}

export type OpdVisitFeature = ReturnType<typeof useOpdVisitFeature>;
