import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { hasPermission } from '../../auth/access-control';
import { useAuth } from '../../auth/useAuth';
import type { Bed, BedPayload, BedStatus, UpdateBedPayload, Ward, WardPayload, WardStatus } from '../../api/admissions-configuration';
import { useBranchesList } from '../branches/useBranches';
import { useAdmissionsConfiguration } from '../useAdmissionsConfiguration';

export function useBedManagementFeature() {
  const { user } = useAuth();
  const superAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const can = (screen: 'Wards' | 'Beds', action: string) => superAdmin || hasPermission(user?.permissions ?? [], { module: 'Admissions', screen, action });
  const branchesQuery = useBranchesList({ status: 'ACTIVE', limit: 100, sortBy: 'name', sortOrder: 'asc' }, superAdmin);
  const branches = superAdmin ? (branchesQuery.data?.data ?? []) : (user?.branches ?? []);
  const [branchId, setBranchId] = useState('');
  const [search, setSearch] = useState('');
  const [bedStatus, setBedStatus] = useState<BedStatus | ''>('');

  useEffect(() => {
    if (!branches.some((branch) => branch.id === branchId)) setBranchId(branches[0]?.id ?? '');
  }, [branchId, branches]);

  const domain = useAdmissionsConfiguration(branchId, search, bedStatus || undefined);
  const saveWard = async (payload: WardPayload, editing?: Ward | null) => {
    if (editing) await domain.updateWard.mutateAsync({ id: editing.id, body: payload });
    else await domain.createWard.mutateAsync(payload);
    toast.success(editing ? 'Ward configuration updated.' : 'Ward created.');
  };
  const saveBed = async (payload: BedPayload, editing?: Bed | null) => {
    if (editing) {
      const update: UpdateBedPayload = { branch_id: payload.branch_id, bed_number: payload.bed_number, bed_category: payload.bed_category, bed_type: payload.bed_type, charge_category: payload.charge_category, gender_restriction: payload.gender_restriction, room_number: payload.room_number };
      await domain.updateBed.mutateAsync({ id: editing.id, body: update });
    } else await domain.createBed.mutateAsync(payload);
    toast.success(editing ? 'Bed configuration updated.' : 'Bed created.');
  };
  const changeWardStatus = async (ward: Ward) => {
    const status: WardStatus = ward.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await domain.wardStatus.mutateAsync({ id: ward.id, body: { branch_id: branchId, status } });
    toast.success(`Ward ${status === 'ACTIVE' ? 'activated' : 'deactivated'}.`);
  };
  const changeBedStatus = async (bed: Bed, status: Extract<BedStatus, 'AVAILABLE' | 'BLOCKED' | 'UNDER_MAINTENANCE' | 'INACTIVE'>) => {
    await domain.bedStatus.mutateAsync({ id: bed.id, body: { branch_id: branchId, status } });
    toast.success(`Bed status changed to ${status.replaceAll('_', ' ').toLowerCase()}.`);
  };

  return {
    state: {
      branches,
      branchId,
      search,
      bedStatus,
      wards: domain.wardsQuery.data?.data ?? [],
      beds: domain.bedsQuery.data?.data ?? [],
      summary: domain.summaryQuery.data ?? { total: 0, available: 0, occupied: 0, reserved: 0, blocked: 0, under_maintenance: 0, inactive: 0 },
      loading: branchesQuery.isLoading || domain.wardsQuery.isLoading || domain.bedsQuery.isLoading || domain.summaryQuery.isLoading,
      saving: domain.createWard.isPending || domain.updateWard.isPending || domain.createBed.isPending || domain.updateBed.isPending || domain.wardStatus.isPending || domain.bedStatus.isPending,
      branchError: branchesQuery.isError,
    },
    capabilities: { canCreateWard: can('Wards', 'Create'), canEditWard: can('Wards', 'Edit'), canChangeWardStatus: can('Wards', 'ChangeStatus'), canCreateBed: can('Beds', 'Create'), canEditBed: can('Beds', 'Edit'), canChangeBedStatus: can('Beds', 'ChangeStatus') },
    actions: { setBranchId, setSearch, setBedStatus, saveWard, saveBed, changeWardStatus, changeBedStatus },
  };
}
