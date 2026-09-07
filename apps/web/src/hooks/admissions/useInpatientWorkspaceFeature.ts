import { useEffect, useMemo, useState } from 'react';
import type { CreateRecommendationPayload } from '../../api/surgery';
import { inpatientAdmissionsApi, type InpatientAdmission } from '../../api/inpatient-admissions';
import { useAppLocation } from '../../routing/navigation';
import { useBranchesList } from '../branches/useBranches';
import { useDepartmentsList } from '../departments/useDepartments';
import { useDoctorsList } from '../doctors/useDoctors';
import { useServicesList } from '../services/useServices';
import { useSurgery } from '../surgery/useSurgery';
import { useWardsList } from '../useAdmissionsConfiguration';
import { useInpatientDownstreamFeature } from './useInpatientDownstreamFeature';
import { useInpatientAdmissionsList, useRefreshInpatientAdmissions } from './useInpatientAdmissionsList';

import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';

type InpatientWorkspaceFilters = {
  selectedWard: string;
  selectedCareLevel: string;
  searchQuery: string;
};

export type InpatientWorkspaceOrder = {
  id: string;
  admission_id: string;
  order_type: 'LAB' | 'IMAGING';
  item_name: string;
  instructions: string;
  status: string;
  ordered_at: string;
};

export function useInpatientWorkspaceFeature(filters: InpatientWorkspaceFilters) {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const roles = user?.roles ?? [];

  const canOrderDiagnostics =
    hasPermission(permissions, { module: 'OPD', screen: 'OPD Clinical Orders', action: 'Edit' }, roles) ||
    hasPermission(permissions, { module: 'OPD', screen: 'OPD Clinical Orders', action: 'Create' }, roles);
  const canAddRoundNote = hasPermission(permissions, {
    module: 'Admissions',
    screen: 'Inpatient Admissions',
    action: 'Create',
  }, roles);
  const canRecordVitals = hasPermission(permissions, {
    module: 'Admissions',
    screen: 'Inpatient Admissions',
    action: 'Create',
  }, roles);
  const canRecommendSurgery = hasPermission(permissions, {
    module: 'Surgery',
    screen: 'Recommendations',
    action: 'Create',
  }, roles);
  const canSaveDischargeSummary = hasPermission(permissions, {
    module: 'Admissions',
    screen: 'Inpatient Admissions',
    action: 'Edit',
  }, roles);
  const canFinalizeDischarge = hasPermission(permissions, {
    module: 'Admissions',
    screen: 'Inpatient Admissions',
    action: 'Discharge',
  }, roles);

  const location = useAppLocation();
  const handoff = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const isSuperAdmin = user?.roles.some((role) => role.code === 'SUPER_ADMIN') ?? false;
  const branchesQuery = useBranchesList(
    { status: 'ACTIVE', page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' },
    isSuperAdmin,
  );
  const branches = isSuperAdmin ? (branchesQuery.data?.data ?? []) : (user?.branches ?? []);

  const defaultBranchId = useMemo(() => {
    const fromQuery = handoff.get('branch_id');
    if (fromQuery) return fromQuery;
    const main = branches.find((b) => b.code?.toUpperCase() === 'MB01' || b.name?.toLowerCase().includes('main'));
    return main ? main.id : (branches[0]?.id ?? '');
  }, [handoff, branches]);

  const [branchIdState, setBranchIdState] = useState(handoff.get('branch_id') ?? '');
  const branchId = branchIdState || defaultBranchId;
  const [selectedAdmission, setSelectedAdmission] = useState<InpatientAdmission | null>(null);

  useEffect(() => {
    if (!branchIdState && branches.length > 0) {
      const main = branches.find((b) => b.code?.toUpperCase() === 'MB01' || b.name?.toLowerCase().includes('main'));
      setBranchIdState(main ? main.id : (branches[0]?.id ?? ''));
    }
  }, [branchIdState, branches]);

  const wardsQuery = useWardsList({ branch_id: branchId }, Boolean(branchId));
  const departmentsQuery = useDepartmentsList({ branch_id: branchId || undefined, status: 'ACTIVE', page: 1, limit: 100 }, Boolean(branchId));
  const doctorsQuery = useDoctorsList({ branch_id: branchId }, Boolean(branchId));
  const servicesQuery = useServicesList({ service_type: 'PROCEDURE' });
  const admissionsQuery = useInpatientAdmissionsList(
    { branch_id: branchId, status: 'ADMITTED' },
    Boolean(branchId),
  );
  const refreshAdmissions = useRefreshInpatientAdmissions();

  const admittedList = admissionsQuery.data?.data ?? [];
  const filteredInpatients = useMemo(() => admittedList.filter((item) => {
    if (filters.selectedWard && item.ward_id !== filters.selectedWard) return false;
    if (filters.selectedCareLevel) {
      const lvl = filters.selectedCareLevel.toUpperCase();
      if (lvl !== 'ALL' && lvl !== '') {
        if (item.admission_type !== lvl && !(lvl === 'MEDICAL' && item.admission_type === 'INPATIENT')) {
          return false;
        }
      }
    }
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      if (
        !item.patient_name?.toLowerCase().includes(query)
        && !item.patient_number?.toLowerCase().includes(query)
        && !item.bed_number?.toLowerCase().includes(query)
        && !item.admitting_doctor_name?.toLowerCase().includes(query)
      ) return false;
    }
    return true;
  }), [admittedList, filters.searchQuery, filters.selectedCareLevel, filters.selectedWard]);

  useEffect(() => {
    if (filteredInpatients.length > 0) {
      if (!selectedAdmission || !filteredInpatients.some((i) => i.id === selectedAdmission.id)) {
        setSelectedAdmission(filteredInpatients[0] ?? null);
      }
    } else {
      setSelectedAdmission(null);
    }
  }, [filteredInpatients, selectedAdmission]);

  const patientId = selectedAdmission?.patient_id;
  const surgery = useSurgery(
    { branch_id: branchId, patient_id: patientId },
    {
      recommendations: Boolean(branchId && patientId),
      bookings: Boolean(branchId && patientId),
    },
  );
  const clinical = useInpatientDownstreamFeature(
    selectedAdmission?.id ?? null,
    branchId,
    Boolean(selectedAdmission && branchId),
  );

  const diagnosticOrders = useMemo(() => {
    if (!selectedAdmission) return [] as InpatientWorkspaceOrder[];
    return ([['LAB', clinical.laboratory.data], ['IMAGING', clinical.imaging.data]] as const)
      .flatMap(([type, order]) => (order?.items || []).map((item, index) => ({
        id: `${order?.id || type}:${index}`,
        admission_id: selectedAdmission.id,
        order_type: type,
        item_name: item.investigation_name,
        instructions: order?.instructions || order?.clinical_notes || '',
        status: order?.status || 'PENDING',
        ordered_at: order?.submitted_at || order?.created_at || new Date().toISOString(),
      })));
  }, [clinical.imaging.data, clinical.laboratory.data, selectedAdmission]);

  const setBranchId = (nextBranchId: string) => {
    setBranchIdState(nextBranchId);
    setSelectedAdmission(null);
  };

  const [isDischarging, setIsDischarging] = useState(false);

  const saveDischargeSummary = async (data: { hemodynamic_stability_24h: boolean; post_op_recovery_cleared: boolean; home_oral_med_converted: boolean; summary_finalized: boolean; notes?: string | null }) => {
    if (!selectedAdmission) return;
    const updated = await inpatientAdmissionsApi.saveDischargeSummary(selectedAdmission.id, branchId, data);
    setSelectedAdmission(updated);
    void refreshAdmissions();
  };

  const finalizeDischarge = async () => {
    if (!selectedAdmission) return;
    setIsDischarging(true);
    try {
      const updated = await inpatientAdmissionsApi.finalizeDischarge(selectedAdmission.id, branchId);
      setSelectedAdmission(updated);
      void refreshAdmissions();
    } finally {
      setIsDischarging(false);
    }
  };

  return {
    state: {
      branchId,
      selectedAdmission,
      branches,
      departments: departmentsQuery.data?.data ?? [],
      wards: wardsQuery.data?.data ?? [],
      doctors: doctorsQuery.data?.data ?? [],
      procedureServices: servicesQuery.data?.data ?? [],
      admittedList,
      filteredInpatients,
      recommendations: surgery.recommendations.data?.data ?? [],
      bookings: surgery.bookings.data?.data ?? [],
      roundNotes: clinical.roundNotes.data ?? [],
      vitals: clinical.vitals.data ?? [],
      diagnosticOrders,
      laboratoryServices: clinical.laboratoryServices,
      imagingServices: clinical.imagingServices,
      isDischarging,
      capabilities: {
        orderDiagnostics: canOrderDiagnostics,
        addRoundNote: canAddRoundNote,
        recordVitals: canRecordVitals,
        recommendSurgery: canRecommendSurgery,
        saveDischargeSummary: canSaveDischargeSummary,
        finalizeDischarge: canFinalizeDischarge,
      },
      loading: {
        admissions: admissionsQuery.isLoading,
        recommendations: surgery.recommendations.isLoading,
        bookings: surgery.bookings.isLoading,
        roundNotes: clinical.roundNotes.isLoading,
        vitals: clinical.vitals.isLoading,
        diagnosticOrders: clinical.laboratory.isLoading || clinical.imaging.isLoading,
      },
      errors: {
        admissions: admissionsQuery.error,
        recommendations: surgery.recommendations.error,
        bookings: surgery.bookings.error,
        roundNotes: clinical.roundNotes.error,
        vitals: clinical.vitals.error,
        diagnosticOrders: clinical.laboratory.error || clinical.imaging.error,
      },
      pending: {
        createRecommendation: surgery.createRecommendation.isPending,
        createRoundNote: clinical.createRoundNote.isPending,
        createVital: clinical.createVital.isPending,
        submitClinicalOrder: clinical.submitClinicalOrder.isPending,
      },
    },
    actions: {
      setBranchId,
      selectAdmission: setSelectedAdmission,
      refreshAdmissions,
      createRecommendation: (payload: CreateRecommendationPayload) => surgery.createRecommendation.mutateAsync(payload),
      createRoundNote: clinical.createRoundNote.mutateAsync,
      createVital: clinical.createVital.mutateAsync,
      submitClinicalOrder: clinical.submitClinicalOrder.mutateAsync,
      saveDischargeSummary,
      finalizeDischarge,
    },
  };
}

export type InpatientWorkspaceFeature = ReturnType<typeof useInpatientWorkspaceFeature>;
