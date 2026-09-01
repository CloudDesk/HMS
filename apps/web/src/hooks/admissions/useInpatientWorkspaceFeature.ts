import { useEffect, useMemo, useState } from 'react';
import type { CreateRecommendationPayload } from '../../api/surgery';
import type { InpatientAdmission } from '../../api/inpatient-admissions';
import { useAppLocation } from '../../routing/navigation';
import { useBranchesList } from '../branches/useBranches';
import { useDoctorsList } from '../doctors/useDoctors';
import { useServicesList } from '../services/useServices';
import { useSurgery } from '../surgery/useSurgery';
import { useWardsList } from '../useAdmissionsConfiguration';
import { useInpatientDownstreamFeature } from './useInpatientDownstreamFeature';
import { useInpatientAdmissionsList, useRefreshInpatientAdmissions } from './useInpatientAdmissionsList';

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
  const location = useAppLocation();
  const handoff = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [branchId, setBranchIdState] = useState(handoff.get('branch_id') ?? '');
  const [selectedAdmission, setSelectedAdmission] = useState<InpatientAdmission | null>(null);

  const branchesQuery = useBranchesList({});
  useEffect(() => {
    const branches = branchesQuery.data?.data ?? [];
    if (!branchId && branches.length > 0) {
      const main = branches.find((b) => b.code?.toUpperCase() === 'MB01' || b.name?.toLowerCase().includes('main'));
      setBranchIdState(main ? main.id : (branches[0]?.id ?? ''));
    }
  }, [branchId, branchesQuery.data]);

  const wardsQuery = useWardsList({ branch_id: branchId }, Boolean(branchId));
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

  return {
    state: {
      branchId,
      selectedAdmission,
      branches: branchesQuery.data?.data ?? [],
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
    },
  };
}

export type InpatientWorkspaceFeature = ReturnType<typeof useInpatientWorkspaceFeature>;
