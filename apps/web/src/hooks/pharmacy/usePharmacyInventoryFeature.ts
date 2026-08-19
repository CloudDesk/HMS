import { useMemo, useCallback } from 'react';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import {
  usePharmacyInventoryList,
  usePharmacyInventorySummary,
  usePharmacyMedicineBatches,
  usePharmacyMovements,
  useAddPharmacyBatch,
  useEditPharmacyBatch,
  useRecordStockMovement,
  useUpdateLowStockThreshold,
} from './usePharmacy';
import { useBranchesList } from '../branches/useBranches';
import { useMedicinesList, useSaveMedicine } from '../medicines/useMedicines';
import {
  type ExpiryState,
  type StockState,
} from '../../api/pharmacy-inventory';

export type InventoryFeatureParams = {
  requestedBranch: string;
  search: string;
  stockState: StockState | '';
  expiryState: ExpiryState | '';
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  selectedMedicineId: string | null;
  detailTab: 'batches' | 'movements';
  modalMode: string | null;
};

export function usePharmacyInventoryFeature(params: InventoryFeatureParams) {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));

  const hasAction = useCallback(
    (action: string) =>
      Boolean(
        isSuperAdmin ||
          user?.permissions.some(
            (permission) =>
              permission.module.toLowerCase() === 'pharmacy' &&
              permission.screen.toLowerCase() === 'medicine inventory' &&
              permission.action.toLowerCase() === action.toLowerCase()
          )
      ),
    [isSuperAdmin, user]
  );

  const permissions = {
    canRegisterBatch: hasAction('RegisterBatch'),
    canRecordMovement: hasAction('RecordMovement'),
    canAdjustStock: hasAction('AdjustStock'),
    canConfigureLowStock: hasAction('ConfigureLowStock'),
    canEditBatch: hasAction('EditBatch') || hasAction('RegisterBatch'), // Fallback if EditBatch isn't explicitly defined
  };

  // Branch Selection
  const { data: branchesData, isLoading: branchesLoading } = useBranchesList(
    { status: 'ACTIVE', page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' },
    isSuperAdmin
  );

  const branches = useMemo(
    () =>
      isSuperAdmin
        ? (branchesData?.data ?? []).map((branch) => ({
            id: branch.id,
            code: branch.code,
            name: branch.name,
          }))
        : user?.branches ?? [],
    [branchesData?.data, isSuperAdmin, user?.branches]
  );

  const activeBranchId = branches.some((branch) => branch.id === params.requestedBranch)
    ? params.requestedBranch
    : branches[0]?.id ?? '';

  // Data Queries
  const { data: listData, isLoading: listLoading } = usePharmacyInventoryList(
    {
      branch_id: activeBranchId,
      search: params.search.trim() || undefined,
      stock_state: params.stockState || undefined,
      expiry_state: params.expiryState || undefined,
      page: params.page,
      limit: params.limit,
      sortBy: params.sortBy as any,
      sortOrder: params.sortOrder,
    },
    Boolean(activeBranchId)
  );

  const { data: summaryData, isLoading: summaryLoading } = usePharmacyInventorySummary(
    activeBranchId,
    Boolean(activeBranchId)
  );

  const { data: medicinesData, isLoading: medicinesLoading } = useMedicinesList(
    { status: 'ACTIVE', page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' },
    Boolean(params.modalMode === 'batch' || params.modalMode === 'add-medicine-master')
  );

  const { data: batchesData, isLoading: batchesLoading } = usePharmacyMedicineBatches(
    params.selectedMedicineId,
    { branch_id: activeBranchId, page: 1, limit: 100, sortBy: 'expiry_date', sortOrder: 'asc' },
    Boolean(params.selectedMedicineId && activeBranchId && (params.modalMode === 'detail' || params.modalMode === 'movement'))
  );

  const { data: movementsData, isLoading: movementsLoading } = usePharmacyMovements(
    { branch_id: activeBranchId, medicine_id: params.selectedMedicineId || undefined, page: 1, limit: 50 },
    Boolean(params.selectedMedicineId && activeBranchId && params.modalMode === 'detail' && params.detailTab === 'movements')
  );

  // Mutations
  const { mutateAsync: addBatch, isPending: isAddingBatch } = useAddPharmacyBatch();
  const { mutateAsync: editBatch, isPending: isEditingBatch } = useEditPharmacyBatch();
  const { mutateAsync: recordMovement, isPending: isRecordingMovement } = useRecordStockMovement();
  const { mutateAsync: updateThreshold, isPending: isUpdatingThreshold } = useUpdateLowStockThreshold();
  const { mutateAsync: saveMedicine, isPending: isSavingMedicine } = useSaveMedicine();

  const isUpdating = isAddingBatch || isEditingBatch || isRecordingMovement || isUpdatingThreshold || isSavingMedicine;
  const isLoading = listLoading || summaryLoading || branchesLoading;
  const isDetailLoading = batchesLoading || movementsLoading || medicinesLoading;

  return {
    branches,
    activeBranchId,
    inventory: listData?.data ?? [],
    meta: listData?.meta,
    summary: summaryData ?? null,
    medicinesOptions: medicinesData?.data ?? [],
    batches: batchesData?.data ?? [],
    movements: movementsData?.data ?? [],
    isLoading,
    isDetailLoading,
    isUpdating,
    permissions,
    actions: {
      addBatch,
      editBatch,
      recordMovement,
      updateThreshold,
      saveMedicine,
    },
  };
}
