import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { admissionsConfigurationService } from '../services/admissions-configuration.service';
import type { BedPayload, BedStatus, UpdateBedPayload, WardPayload, WardStatus } from '../api/admissions-configuration';

export const useAdmissionsConfiguration = (branchId: string, search: string, bedStatusFilter?: BedStatus) => {
  const queryClient = useQueryClient();
  const wardsQuery = useQuery({ queryKey: ['admissions', 'wards', { branchId, search }], queryFn: () => admissionsConfigurationService.wards({ branch_id: branchId, search: search || undefined, limit: 100 }), enabled: Boolean(branchId) });
  const bedsQuery = useQuery({ queryKey: ['admissions', 'beds', { branchId, search, bedStatusFilter }], queryFn: () => admissionsConfigurationService.beds({ branch_id: branchId, search: search || undefined, status: bedStatusFilter, limit: 100 }), enabled: Boolean(branchId) });
  const summaryQuery = useQuery({ queryKey: ['admissions', 'bed-summary', branchId], queryFn: () => admissionsConfigurationService.summary(branchId), enabled: Boolean(branchId) });
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['admissions', 'wards'] }); void queryClient.invalidateQueries({ queryKey: ['admissions', 'beds'] }); void queryClient.invalidateQueries({ queryKey: ['admissions', 'bed-summary', branchId] }); };
  const createWard = useMutation({ mutationFn: (body: WardPayload) => admissionsConfigurationService.createWard(body), onSuccess: refresh });
  const updateWard = useMutation({ mutationFn: ({ id, body }: { id: string; body: WardPayload }) => admissionsConfigurationService.updateWard(id, body), onSuccess: refresh });
  const createBed = useMutation({ mutationFn: (body: BedPayload) => admissionsConfigurationService.createBed(body), onSuccess: refresh });
  const updateBed = useMutation({ mutationFn: ({ id, body }: { id: string; body: UpdateBedPayload }) => admissionsConfigurationService.updateBed(id, body), onSuccess: refresh });
  const wardStatus = useMutation({ mutationFn: ({ id, body }: { id: string; body: { branch_id: string; status: WardStatus } }) => admissionsConfigurationService.updateWardStatus(id, body), onSuccess: refresh });
  const bedStatus = useMutation({ mutationFn: ({ id, body }: { id: string; body: { branch_id: string; status: BedStatus } }) => admissionsConfigurationService.updateBedStatus(id, body), onSuccess: refresh });
  return { wardsQuery, bedsQuery, summaryQuery, createWard, updateWard, createBed, updateBed, wardStatus, bedStatus };
};
