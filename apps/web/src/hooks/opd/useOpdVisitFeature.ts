import { useLayoutEffect, useMemo } from 'react';
import type { CreateBillingInvoicePayload } from '../../api/billing';
import type { InventoryItem } from '../../api/pharmacy-inventory';
import type {
  ApiClinicalOrderType,
  SaveOpdClinicalOrderPayload,
  SaveOpdConsultationPayload,
  SaveOpdFollowUpPayload,
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
import { hasPermission } from '../../auth/access-control';
import { useAuth } from '../../auth/useAuth';

const WORKSPACE_TABS = [
  { id: '1', label: '1 Consultation', name: 'Consultation' },
  { id: '2', label: '2 Diagnosis', name: 'Diagnosis' },
  { id: '3', label: '3 Prescription', name: 'Prescription' },
  { id: '4', label: '4 Lab Orders', name: 'Lab Orders' },
  { id: '5', label: '5 Imaging Orders', name: 'Imaging Orders' },
  { id: '6', label: '6 Referral', name: 'Referral' },
  { id: '7', label: '7 Follow-up', name: 'Follow-up' },
  { id: '8', label: '8 Notes', name: 'Notes' },
  { id: '9', label: '9 Documents', name: 'Documents' },
] as const;

type SaveWorkspaceDraftInput = {
  consultation: SaveOpdConsultationPayload;
  prescription?: SaveOpdPrescriptionPayload;
  laboratory?: SaveOpdClinicalOrderPayload;
  imaging?: SaveOpdClinicalOrderPayload;
  referral?: SaveOpdReferralPayload;
  followUp?: SaveOpdFollowUpPayload;
};

type CompleteWorkspaceInput = SaveWorkspaceDraftInput & {
  invoice?: CreateBillingInvoicePayload;
};

export function useOpdVisitFeature() {
  const { search } = useAppLocation();
  const { user } = useAuth();
  const canView = (module: string, screen: string) => hasPermission(user?.permissions ?? [], { module, screen, action: 'View' });
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  // In Consultation Workspace, only in-consultation and completed visits are valid for active review/switching
  const recentVisitsQuery = useOpdVisits({ limit: 20, sortBy: 'created_at', sortOrder: 'desc' }, canView('OPD', 'OPD Visits'));
  const recentVisits = useMemo(() => {
    const list = recentVisitsQuery.data?.data ?? [];
    return list.filter((v) => v.status === 'IN_CONSULTATION' || v.status === 'COMPLETED');
  }, [recentVisitsQuery.data]);

  const activeVisitId = searchParams.get('id') ?? recentVisits[0]?.id ?? '';
  const specialtyCompletionRequired = searchParams.get('specialty') === 'ophthalmology';
  const tabParam = searchParams.get('tab') ?? 'Consultation';
  const activeTab = WORKSPACE_TABS.find((tab) => tab.name.toLowerCase() === tabParam.toLowerCase() || tab.id === tabParam)?.name ?? 'Consultation';
  const workspace = useOpdWorkspace(activeVisitId || null, activeTab);
  const visit = workspace.visit?.id === activeVisitId ? workspace.visit : null;
  const context = useMemo(() => ({ active: true, pending: false, completionCommitted: false }), [activeVisitId]);
  useLayoutEffect(() => {
    context.active = true;
    return () => { context.active = false; };
  }, [context]);
  const assertContext = () => {
    if (workspace.visitError) throw new Error('Reload the encounter records successfully before saving.');
    if (!context.active || !visit) throw new Error('The selected encounter changed. Refresh its saved records before continuing.');
  };

  const patientQuery = usePatientDetails(canView('Patients', 'Patient Records') ? visit?.patient_id ?? null : null);
  const branchesQuery = useBranchesList({ status: 'ACTIVE', limit: 100 }, Boolean(visit && activeTab === 'Lab Orders' && canView('Administration', 'Branches')));
  const departmentsQuery = useDepartmentsList({ status: 'ACTIVE', limit: 100 }, Boolean(visit && (activeTab === 'Lab Orders' || activeTab === 'Imaging Orders') && canView('Administration', 'Departments')));
  const callNextPatient = useCallNextOpdPatient({ notifyOnError: false });

  const masterMedicines = useMemo(() => {
    const inventoryById: Record<string, InventoryItem> = {};
    workspace.inventory.forEach((item) => {
      inventoryById[item.medicine_id] = item;
    });
    return workspace.medicines.map((medicine) => {
      const inventory = inventoryById[medicine.id];
      return {
        id: medicine.id,
        name: medicine.name,
        generic_name: medicine.generic_name,
        strength: medicine.strength,
        dosage_form: medicine.dosage_form,
        unit: medicine.unit || 'units',
        available_quantity: inventory?.available_quantity ?? null,
      };
    });
  }, [workspace.inventory, workspace.medicines]);

  const runWorkflow = async (steps: Array<{ label: string; run: () => Promise<unknown> }>) => {
    assertContext();
    if (context.pending) throw new Error('A save is already in progress for this encounter.');
    context.pending = true;
    let saved = 0;
    try {
      for (const step of steps) {
        assertContext();
        try { await step.run(); }
        catch (error) {
          throw new Error(`${step.label} failed: ${getOpdErrorMessage(error)}${saved ? ' Earlier steps were saved. Refresh and review those records before retrying.' : ''}`, { cause: error });
        }
        saved += 1;
      }
      assertContext();
    } finally { context.pending = false; }
  };

  const saveWorkspaceDraft = async (input: SaveWorkspaceDraftInput) => {
    const { prescription, laboratory, imaging, referral, followUp, } = input;
    assertContext();
    const visitId = activeVisitId;
    await runWorkflow([
      { label: 'Consultation draft', run: () => workspace.mutations.saveConsultationDraft({ visitId, payload: input.consultation }) },
      ...(prescription ? [{ label: 'Prescription draft', run: () => workspace.mutations.savePrescriptionDraft({ visitId, payload: prescription }) }] : []),
      ...(laboratory ? [{ label: 'Laboratory draft', run: () => workspace.mutations.saveClinicalOrderDraft({ visitId, type: 'LABORATORY', payload: laboratory }) }] : []),
      ...(imaging ? [{ label: 'Imaging draft', run: () => workspace.mutations.saveClinicalOrderDraft({ visitId, type: 'IMAGING', payload: imaging }) }] : []),
      ...(referral ? [{ label: 'Referral draft', run: () => workspace.mutations.saveReferralDraft({ visitId, payload: referral }) }] : []),
      ...(followUp ? [{ label: 'Follow-up draft', run: () => workspace.mutations.saveFollowUpDraft({ visitId, payload: followUp }) }] : []),
    ]);
  };

  const completeWorkspace = async (input: CompleteWorkspaceInput) => {
    const { prescription, laboratory, imaging, referral, followUp, invoice, } = input;
    assertContext();
    if (specialtyCompletionRequired) throw new Error('Return to Ophthalmology readiness. This encounter cannot be completed from the generic OPD workflow.');
    if (context.completionCommitted || visit?.status === 'COMPLETED') throw new Error('This consultation is already completed. Review downstream records individually before retrying any handoff.');
    const visitId = activeVisitId;
    try {
      await runWorkflow([
        { label: 'Consultation completion', run: async () => {
          const result = await workspace.mutations.completeConsultation({ visitId, payload: input.consultation });
          context.completionCommitted = true;
          return result;
        } },
        ...(prescription ? [{ label: 'Pharmacy handoff', run: () => workspace.mutations.submitPrescription({ visitId, payload: prescription }) }] : []),
        ...(laboratory ? [{ label: 'Laboratory handoff', run: () => workspace.mutations.submitClinicalOrder({ visitId, type: 'LABORATORY', payload: laboratory }) }] : []),
        ...(imaging ? [{ label: 'Imaging handoff', run: () => workspace.mutations.submitClinicalOrder({ visitId, type: 'IMAGING', payload: imaging }) }] : []),
        ...(referral ? [{ label: 'Referral handoff', run: () => workspace.mutations.submitReferral({ visitId, payload: referral }) }] : []),
        ...(followUp ? [{ label: 'Follow-up scheduling', run: () => workspace.mutations.scheduleFollowUp({ visitId, payload: followUp }) }] : []),
        ...(invoice ? [{ label: 'Billing handoff', run: () => workspace.mutations.createBillingInvoice(invoice) }] : []),
      ]);
    } finally {
      // Completion already updates the visit atomically on the backend; never replay its status transition.
      if (context.active) await workspace.refetchVisit();
    }
  };

  const selectVisit = (visitId: string) => {
    if (visitId === activeVisitId) return;
    context.active = false;
    const next = new URLSearchParams(search);
    next.set('id', visitId);
    next.delete('specialty');
    navigate(`/opd/consultation?${next.toString()}`);
  };

  const setActiveTab = (tab: string) => {
    if (!WORKSPACE_TABS.some((item) => item.name === tab)) return;
    const next = new URLSearchParams(search);
    if (activeVisitId) next.set('id', activeVisitId);
    next.set('tab', tab);
    navigate(`/opd/consultation?${next.toString()}`, { replace: true });
  };

  const refetchVisit = async () => {
    await Promise.all([workspace.refetchVisit(), patientQuery.refetch()]);
  };

  return {
    state: {
      activeVisitId,
      activeTab, specialtyCompletionRequired,
      recentVisits,
      visit,
      patient: patientQuery.data?.id === visit?.patient_id ? patientQuery.data : null,
      vitals: workspace.vitals,
      consultation: workspace.consultation,
      prescription: workspace.prescription,
      followUp: workspace.followUp,
      referral: workspace.referral,
      laboratoryOrder: workspace.labOrder,
      imagingOrder: workspace.imagingOrder,
      doctors: workspace.doctors,
      masterMedicines,
      services: workspace.services,
      branches: branchesQuery.data?.data ?? [],
      departments: departmentsQuery.data?.data ?? [],
      documents: workspace.documents,
      loading: recentVisitsQuery.isLoading || workspace.isLoading || workspace.visitLoading || patientQuery.isLoading,
      loadError: workspace.visitError ? getOpdErrorMessage(workspace.visitError) : '',
      updating: workspace.isUpdating || callNextPatient.isPending,
      canEditConsultation: workspace.canEditConsultation,
      canEditPrescription: workspace.canEditPrescription,
      canEditClinicalOrders: workspace.canEditClinicalOrders,
      canEditReferral: workspace.canEditReferral,
      canEditFollowUp: workspace.canEditFollowUp,
      canCreateVitals: workspace.canCreateVitals,
      canOpenOphthalmology: (canView('OPD', 'Ophthalmology Intake') && canView('OPD', 'OPD Visits')) || canView('OPD', 'Ophthalmology Consultation') || canView('OPD', 'Ophthalmology Optical Prescription'),
    },
    actions: {
      openSpecialtyCompletion: () => { if (visit) navigate(`/opd/ophthalmology?visit_id=${encodeURIComponent(visit.id)}&section=completion`); },
      setActiveTab,
      selectVisit,
      refetchVisit,
      createVitals: workspace.mutations.createVitals,
      submitReferral: workspace.mutations.submitReferral,
      scheduleFollowUp: workspace.mutations.scheduleFollowUp,
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
