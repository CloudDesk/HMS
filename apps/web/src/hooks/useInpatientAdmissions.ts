import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { admissionsConfigurationApi } from '../api/admissions-configuration';
import { branchesApi } from '../api/branches';
import { departmentsApi } from '../api/departments';
import { doctorsApi } from '../api/doctors';
import type { ConfirmAdmissionRequestPayload, CreateAdmissionRequestPayload, ValidateAdmissionRequestPayload } from '../api/inpatient-admissions';
import { patientsApi } from '../api/patients';
import { inpatientAdmissionsService } from '../services/inpatient-admissions.service';

export const useInpatientAdmissions = (branchId: string, patientSearch: string, requestSearch = '') => {
  const client = useQueryClient();
  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: ['admissions', 'requests'] }),
    client.invalidateQueries({ queryKey: ['admissions', 'inpatients'] }),
    client.invalidateQueries({ queryKey: ['admissions', 'available-beds'] }),
    client.invalidateQueries({ queryKey: ['admissions', 'configuration'] }),
  ]);
  const branches = useQuery({ queryKey: ['admissions', 'branches'], queryFn: () => branchesApi.list({ status: 'ACTIVE', page: 1, limit: 100 }) });
  const patients = useQuery({ queryKey: ['admissions', 'patients', patientSearch], queryFn: () => patientsApi.list({ search: patientSearch, status: 'ACTIVE', page: 1, limit: 20 }), enabled: patientSearch.length >= 2 });
  const doctors = useQuery({ queryKey: ['admissions', 'doctors', branchId], queryFn: () => doctorsApi.list({ branch_id: branchId, status: 'ACTIVE', page: 1, limit: 100 }), enabled: Boolean(branchId) });
  const departments = useQuery({ queryKey: ['admissions', 'departments', branchId], queryFn: () => departmentsApi.list({ branch_id: branchId, status: 'ACTIVE', page: 1, limit: 100 }), enabled: Boolean(branchId) });
  const wards = useQuery({ queryKey: ['admissions', 'wards', branchId], queryFn: () => admissionsConfigurationApi.wards({ branch_id: branchId, status: 'ACTIVE', page: 1, limit: 100 }), enabled: Boolean(branchId) });
  const beds = useQuery({ queryKey: ['admissions', 'available-beds', branchId], queryFn: () => admissionsConfigurationApi.beds({ branch_id: branchId, status: 'AVAILABLE', page: 1, limit: 100 }), enabled: Boolean(branchId) });
  const policy = useQuery({ queryKey: ['admissions', 'policy', branchId], queryFn: () => admissionsConfigurationApi.policy(branchId), enabled: Boolean(branchId), retry: false });
  const requests = useQuery({ queryKey: ['admissions', 'requests', branchId, requestSearch], queryFn: () => inpatientAdmissionsService.requests({ branch_id: branchId, search: requestSearch || undefined, page: 1, limit: 50 }), enabled: Boolean(branchId) });
  const admissions = useQuery({ queryKey: ['admissions', 'inpatients', branchId], queryFn: () => inpatientAdmissionsService.list({ branch_id: branchId, page: 1, limit: 50 }), enabled: Boolean(branchId) });
  const createRequest = useMutation({ mutationFn: (payload: CreateAdmissionRequestPayload) => inpatientAdmissionsService.createRequest(payload), onSuccess: refresh });
  const validateRequest = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: ValidateAdmissionRequestPayload }) => inpatientAdmissionsService.validateRequest(id, branchId, payload), onSuccess: refresh });
  const confirmRequest = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: ConfirmAdmissionRequestPayload }) => inpatientAdmissionsService.confirmRequest(id, branchId, payload), onSuccess: refresh });
  const cancelRequest = useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => inpatientAdmissionsService.cancelRequest(id, branchId, reason), onSuccess: refresh });
  return { branches, patients, doctors, departments, wards, beds, policy, requests, admissions, createRequest, validateRequest, confirmRequest, cancelRequest };
};
