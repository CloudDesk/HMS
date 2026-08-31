import { useEffect, useMemo, useState } from 'react';
import type {
  AdmissionRequest,
  ConfirmAdmissionRequestPayload,
  CreateAdmissionRequestPayload,
  ValidateAdmissionRequestPayload,
} from '../../api/inpatient-admissions';
import type { UploadPatientDocumentPayload } from '../../api/patients';
import { useAppLocation } from '../../routing/navigation';
import { useAdvancePaymentFeature } from '../advance-payment/useAdvancePaymentFeature';
import { useEmergencyEncountersList } from '../emergency/useEmergency';
import { useOpdVisits } from '../opd/useOpd';
import { useInpatientAdmissions } from '../useInpatientAdmissions';
import { useInpatientDownstreamFeature } from './useInpatientDownstreamFeature';

export type AdmissionPatientOption = {
  patientId: string;
  label: string;
  doctorId: string;
  departmentId: string;
  sourceId: string;
};

type InpatientAdmissionFeatureOptions = {
  patientSearch: string;
  requestSearch: string;
  createOpen: boolean;
  selectedRequest: AdmissionRequest | null;
  selectedSourceType: CreateAdmissionRequestPayload['source_type'];
  wardId: string;
};

export function useInpatientAdmissionFeature(options: InpatientAdmissionFeatureOptions) {
  const location = useAppLocation();
  const handoff = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [branchId, setBranchId] = useState(handoff.get('branch_id') ?? '');
  const domain = useInpatientAdmissions(branchId, options.patientSearch, options.requestSearch);

  useEffect(() => {
    const firstBranchId = domain.branches.data?.data[0]?.id;
    if (!branchId && firstBranchId) setBranchId(firstBranchId);
  }, [branchId, domain.branches.data]);

  const opdVisits = useOpdVisits(
    { branch_id: branchId },
    Boolean(branchId) && options.createOpen,
  );
  const emergencyEncounters = useEmergencyEncountersList(
    { branch_id: branchId },
    Boolean(branchId) && options.createOpen,
  );
  const advancePayment = useAdvancePaymentFeature('ADMISSION_REQUEST', options.selectedRequest?.id ?? null);
  const downstream = useInpatientDownstreamFeature(
    options.selectedRequest?.admission_id ?? null,
    branchId,
    Boolean(options.selectedRequest?.status === 'CONFIRMED' && options.selectedRequest.admission_id),
  );

  const beds = useMemo(
    () => (domain.beds.data?.data ?? []).filter((bed) => !options.wardId || bed.ward_id === options.wardId),
    [domain.beds.data, options.wardId],
  );
  const departmentOptions = useMemo(() => {
    const scoped = domain.departments.data?.data;
    return scoped && scoped.length > 0 ? scoped : (domain.allDepartments.data?.data ?? []);
  }, [domain.allDepartments.data, domain.departments.data]);
  const doctorOptions = useMemo(() => {
    const scoped = domain.doctors.data?.data;
    return scoped && scoped.length > 0 ? scoped : (domain.allDoctors.data?.data ?? []);
  }, [domain.allDoctors.data, domain.doctors.data]);

  const opdPatients = useMemo<AdmissionPatientOption[]>(() => (opdVisits.data?.data ?? []).map((visit) => ({
    patientId: visit.patient_id,
    label: `${visit.patient_name} · ${visit.patient_number} (OPD Visit: ${visit.visit_number})`,
    doctorId: visit.doctor_id,
    departmentId: visit.department_id,
    sourceId: visit.id,
  })), [opdVisits.data]);
  const emergencyPatients = useMemo<AdmissionPatientOption[]>(() => (emergencyEncounters.data?.data ?? []).map((encounter) => ({
    patientId: encounter.patient_id || encounter.id,
    label: `${encounter.patient_name} · ${encounter.patient_number || encounter.emergency_identifier} (ER: ${encounter.chief_complaint || 'Active'})`,
    doctorId: encounter.assigned_doctor_id || '',
    departmentId: encounter.department_id || '',
    sourceId: encounter.id,
  })), [emergencyEncounters.data]);
  const registeredPatients = useMemo<AdmissionPatientOption[]>(() => {
    const patients = domain.activePatients.data?.data || domain.patients.data?.data || [];
    return patients.map((patient) => ({
      patientId: patient.id,
      label: `${[patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ')} · ${patient.patient_number}`,
      doctorId: '',
      departmentId: '',
      sourceId: '',
    }));
  }, [domain.activePatients.data, domain.patients.data]);
  const availablePatients = options.selectedSourceType === 'OPD_VISIT'
    ? opdPatients
    : options.selectedSourceType === 'EMERGENCY_ENCOUNTER'
      ? emergencyPatients
      : registeredPatients;

  const uploadConsent = (patientId: string, payload: UploadPatientDocumentPayload) =>
    domain.uploadConsent.mutateAsync({ id: patientId, payload });

  return {
    state: {
      branchId,
      branches: domain.branches.data?.data ?? [],
      wards: domain.wards.data?.data ?? [],
      beds,
      requests: domain.requests.data?.data ?? [],
      policy: domain.policy.data,
      counts: domain.requestStats?.data?.data ?? { pendingValidation: 0, readyForConfirmation: 0, confirmed: 0, cancelled: 0 },
      departmentOptions,
      doctorOptions,
      availablePatients,
      advancePayment: advancePayment.advancePayment,
      downstream,
      loading: {
        requests: domain.requests.isLoading,
        configuration: domain.wards.isLoading || domain.beds.isLoading || domain.policy.isLoading,
        modalPatients: opdVisits.isLoading || emergencyEncounters.isLoading,
      },
      errors: {
        requests: domain.requests.error,
        policy: domain.policy.error,
        configuration: domain.wards.error || domain.beds.error,
        modalPatients: opdVisits.error || emergencyEncounters.error,
      },
      pending: {
        createRequest: domain.createRequest.isPending,
        validateRequest: domain.validateRequest.isPending,
        confirmRequest: domain.confirmRequest.isPending,
        cancelRequest: domain.cancelRequest.isPending,
        uploadConsent: domain.uploadConsent.isPending,
      },
    },
    actions: {
      setBranchId,
      createRequest: (payload: CreateAdmissionRequestPayload) => domain.createRequest.mutateAsync(payload),
      validateRequest: (input: { id: string; patientId: string; payload: ValidateAdmissionRequestPayload }) => domain.validateRequest.mutateAsync(input),
      confirmRequest: (input: { id: string; patientId: string; payload: ConfirmAdmissionRequestPayload }) => domain.confirmRequest.mutateAsync(input),
      cancelRequest: (input: { id: string; reason: string }) => domain.cancelRequest.mutateAsync(input),
      uploadConsent,
    },
  };
}

export type InpatientAdmissionFeature = ReturnType<typeof useInpatientAdmissionFeature>;
