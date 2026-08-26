import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const LOOKUP_STALE_TIME = 5 * 60 * 1000;
import { admissionsConfigurationApi } from '../api/admissions-configuration';
import { branchesApi } from '../api/branches';
import { departmentsApi } from '../api/departments';
import { doctorsApi } from '../api/doctors';
import type { ConfirmAdmissionRequestPayload, CreateAdmissionRequestPayload, ValidateAdmissionRequestPayload } from '../api/inpatient-admissions';
import { patientsApi } from '../api/patients';
import { inpatientAdmissionsService } from '../services/inpatient-admissions.service';
import { useLinkAdmissionBillingContext } from './billing/useBilling';
import { useConsentTemplates } from './consents/useConsents';
import { useUploadPatientDocument } from './patients/usePatients';

export const useInpatientAdmissions = (branchId: string, patientSearch: string, requestSearch = '', consentOpen = false, createOpen = false, allocationOpen = false) => {
  const client = useQueryClient();
  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: ['admissions', 'requests'] }),
    client.invalidateQueries({ queryKey: ['admissions', 'inpatients'] }),
    client.invalidateQueries({ queryKey: ['admissions', 'available-beds'] }),
    client.invalidateQueries({ queryKey: ['admissions', 'configuration'] }),
  ]);
  const branches = useQuery({ queryKey: ['admissions', 'branches'], queryFn: () => branchesApi.list({ status: 'ACTIVE', page: 1, limit: 100 }), staleTime: LOOKUP_STALE_TIME });
  const patients = useQuery({ queryKey: ['admissions', 'patients', patientSearch], queryFn: () => patientsApi.list({ search: patientSearch, status: 'ACTIVE', page: 1, limit: 20 }), enabled: patientSearch.length >= 2 });
  const doctors = useQuery({ queryKey: ['admissions', 'doctors', branchId], queryFn: () => doctorsApi.list({ branch_id: branchId, status: 'ACTIVE', page: 1, limit: 100 }), enabled: Boolean(branchId) && createOpen, staleTime: LOOKUP_STALE_TIME });
  const departments = useQuery({ queryKey: ['admissions', 'departments', branchId], queryFn: () => departmentsApi.list({ branch_id: branchId, status: 'ACTIVE', page: 1, limit: 100 }), enabled: Boolean(branchId) && createOpen, staleTime: LOOKUP_STALE_TIME });
  const wards = useQuery({ queryKey: ['admissions', 'wards', branchId], queryFn: () => admissionsConfigurationApi.wards({ branch_id: branchId, status: 'ACTIVE', page: 1, limit: 100 }), enabled: Boolean(branchId) && allocationOpen, staleTime: LOOKUP_STALE_TIME });
  const beds = useQuery({ queryKey: ['admissions', 'available-beds', branchId], queryFn: () => admissionsConfigurationApi.beds({ branch_id: branchId, status: 'AVAILABLE', page: 1, limit: 100 }), enabled: Boolean(branchId) && allocationOpen });
  const policy = useQuery({ queryKey: ['admissions', 'policy', branchId], queryFn: () => admissionsConfigurationApi.policy(branchId), enabled: Boolean(branchId), retry: false });
  const requests = useQuery({ queryKey: ['admissions', 'requests', branchId, requestSearch], queryFn: () => inpatientAdmissionsService.requests({ branch_id: branchId, search: requestSearch || undefined, page: 1, limit: 50 }), enabled: Boolean(branchId) });
  const requestStats = useQuery({ queryKey: ['admissions', 'requestStats', branchId], queryFn: () => inpatientAdmissionsService.requestStats(branchId), enabled: Boolean(branchId) });
  const consentTemplates = useConsentTemplates({ branch_id: branchId, context_type: 'ADMISSION', status: 'ACTIVE' }, consentOpen);
  const uploadConsent = useUploadPatientDocument();
  const linkAdmissionBillingContext = useLinkAdmissionBillingContext();
  const createRequest = useMutation({ mutationFn: (payload: CreateAdmissionRequestPayload) => inpatientAdmissionsService.createRequest(payload), onSuccess: refresh });
  const validateRequest = useMutation({ mutationFn: async ({ id, patientId, payload }: { id: string; patientId: string; payload: ValidateAdmissionRequestPayload }) => {
    if (payload.deposit_invoice_id) await linkAdmissionBillingContext.mutateAsync({ id: payload.deposit_invoice_id, payload: { patient_id: patientId, branch_id: branchId, request_id: id } });
    return inpatientAdmissionsService.validateRequest(id, branchId, payload);
  }, onSuccess: refresh });
  const confirmRequest = useMutation({ mutationFn: async ({ id, patientId, payload }: { id: string; patientId: string; payload: ConfirmAdmissionRequestPayload }) => {
    if (payload.deposit_invoice_id) await linkAdmissionBillingContext.mutateAsync({ id: payload.deposit_invoice_id, payload: { patient_id: patientId, branch_id: branchId, request_id: id } });
    return inpatientAdmissionsService.confirmRequest(id, branchId, payload);
  }, onSuccess: refresh });
  const cancelRequest = useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => inpatientAdmissionsService.cancelRequest(id, branchId, reason), onSuccess: refresh });
  return { branches, patients, doctors, departments, wards, beds, policy, requests, requestStats, consentTemplates, uploadConsent, createRequest, validateRequest, confirmRequest, cancelRequest };
};
