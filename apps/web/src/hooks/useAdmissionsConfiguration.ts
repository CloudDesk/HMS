import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { admissionsConfigurationService } from '../services/admissions-configuration.service';
import type {
  AdmissionPolicyPayload,
  BedPayload,
  BedStatus,
  WardPayload,
  WardStatus,
} from '../api/admissions-configuration';

type AdmissionsConfigurationParams = {
  branchId: string;
  search: string;
  bedStatus?: BedStatus;
  wardId?: string;
  page: number;
  limit: number;
  canViewPolicy: boolean;
  enabled?: boolean;
  canViewWards?: boolean;
  canViewBeds?: boolean;
};

export const admissionsConfigurationKeys = {
  all: ['admissions', 'configuration'] as const,
  wards: (branchId: string) =>
    [...admissionsConfigurationKeys.all, 'wards', branchId] as const,
  wardList: (branchId: string, params: object) =>
    [...admissionsConfigurationKeys.wards(branchId), 'list', params] as const,
  beds: (branchId: string) =>
    [...admissionsConfigurationKeys.all, 'beds', branchId] as const,
  bedList: (branchId: string, params: object) =>
    [...admissionsConfigurationKeys.beds(branchId), 'list', params] as const,
  summary: (branchId: string) =>
    [...admissionsConfigurationKeys.all, 'summary', branchId] as const,
  policy: (branchId: string) =>
    [...admissionsConfigurationKeys.all, 'policy', branchId] as const,
};

export const useAdmissionsConfiguration = ({
  branchId,
  search,
  bedStatus,
  wardId,
  page,
  limit,
  canViewPolicy,
  enabled = true,
  canViewWards = true,
  canViewBeds = true,
}: AdmissionsConfigurationParams) => {
  const queryClient = useQueryClient();

  const wardParams = {
    branch_id: branchId,
    limit: 100,
  };

  const bedParams = {
    branch_id: branchId,
    search: search || undefined,
    status: bedStatus,
    ward_id: wardId || undefined,
    page,
    limit,
  };

  const wardsQuery = useQuery({
    queryKey: admissionsConfigurationKeys.wardList(branchId, wardParams),
    queryFn: () => admissionsConfigurationService.wards(wardParams),
    enabled: enabled && canViewWards && Boolean(branchId),
  });

  const bedsQuery = useQuery({
    queryKey: admissionsConfigurationKeys.bedList(branchId, bedParams),
    queryFn: () => admissionsConfigurationService.beds(bedParams),
    enabled: enabled && canViewBeds && Boolean(branchId),
  });

  const summaryQuery = useQuery({
    queryKey: admissionsConfigurationKeys.summary(branchId),
    queryFn: () => admissionsConfigurationService.summary(branchId),
    enabled: enabled && canViewBeds && Boolean(branchId),
  });

  const policyQuery = useQuery({
    queryKey: admissionsConfigurationKeys.policy(branchId),
    queryFn: () => admissionsConfigurationService.policy(branchId),
    enabled: enabled && Boolean(branchId) && canViewPolicy,
    retry: false,
  });

  const refreshBeds = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: admissionsConfigurationKeys.beds(branchId),
      }),
      queryClient.invalidateQueries({
        queryKey: admissionsConfigurationKeys.summary(branchId),
      }),
    ]);
  };

  const refreshConfiguration = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: admissionsConfigurationKeys.wards(branchId),
      }),
      refreshBeds(),
    ]);
  };

  const createWard = useMutation({
    mutationFn: (body: WardPayload) =>
      admissionsConfigurationService.createWard(body),
    onSuccess: refreshConfiguration,
  });

  const createBed = useMutation({
    mutationFn: (body: BedPayload) =>
      admissionsConfigurationService.createBed(body),
    onSuccess: refreshBeds,
  });

  const wardStatus = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { branch_id: string; status: WardStatus };
    }) => admissionsConfigurationService.updateWardStatus(id, body),
    onSuccess: refreshConfiguration,
  });

  const bedStatusMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: {
        branch_id: string;
        status: Exclude<BedStatus, 'OCCUPIED' | 'RESERVED'>;
        reason?: string | null;
      };
    }) => admissionsConfigurationService.updateBedStatus(id, body),
    onSuccess: refreshBeds,
  });

  const savePolicy = useMutation({
    mutationFn: (body: AdmissionPolicyPayload) =>
      admissionsConfigurationService.savePolicy(body),
    onSuccess: async () =>
      queryClient.invalidateQueries({
        queryKey: admissionsConfigurationKeys.policy(branchId),
      }),
  });

  const createHold = useMutation({
    mutationFn: ({
      bedId,
      body,
    }: {
      bedId: string;
      body: {
        branch_id: string;
        patient_id: string;
        reason: string;
        idempotency_key: string;
      };
    }) => admissionsConfigurationService.createHold(bedId, body),
    onSuccess: refreshBeds,
  });

  const releaseHold = useMutation({
    mutationFn: ({
      holdId,
      body,
    }: {
      holdId: string;
      body: { branch_id: string; reason: string };
    }) => admissionsConfigurationService.releaseHold(holdId, body),
    onSuccess: refreshBeds,
  });

  const cancelHold = useMutation({
    mutationFn: ({
      holdId,
      body,
    }: {
      holdId: string;
      body: { branch_id: string; reason: string };
    }) => admissionsConfigurationService.cancelHold(holdId, body),
    onSuccess: refreshBeds,
  });

  const transfer = useMutation({
    mutationFn: ({
      admissionId,
      body,
      crossBranch,
    }: {
      admissionId: string;
      body: {
        branch_id: string;
        destination_branch_id: string;
        destination_ward_id: string;
        destination_bed_id: string;
        reason: string;
      };
      crossBranch: boolean;
    }) =>
      admissionsConfigurationService.requestAndCompleteTransfer(
        admissionId,
        body,
        crossBranch,
      ),
    onSuccess: refreshBeds,
  });

  return {
    wardsQuery,
    bedsQuery,
    summaryQuery,
    policyQuery,
    createWard,
    createBed,
    wardStatus,
    bedStatus: bedStatusMutation,
    savePolicy,
    createHold,
    releaseHold,
    cancelHold,
    transfer,
  };
};

export const useBedTransferOptions = (
  branchId: string,
  enabled: boolean,
) => {
  const wardParams = {
    branch_id: branchId,
    status: 'ACTIVE' as const,
    limit: 100,
  };

  const bedParams = {
    branch_id: branchId,
    status: 'AVAILABLE' as const,
    page: 1,
    limit: 100,
  };

  const wardsQuery = useQuery({
    queryKey: admissionsConfigurationKeys.wardList(
      branchId,
      wardParams,
    ),
    queryFn: () => admissionsConfigurationService.wards(wardParams),
    enabled: enabled && Boolean(branchId),
  });

  const bedsQuery = useQuery({
    queryKey: admissionsConfigurationKeys.bedList(
      branchId,
      bedParams,
    ),
    queryFn: () => admissionsConfigurationService.beds(bedParams),
    enabled: enabled && Boolean(branchId),
  });

  return { wardsQuery, bedsQuery };
};

