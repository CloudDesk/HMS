import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../api/api-error';
import type {
  Dispensing,
  DispensingItem,
  DispensingQueueStatus,
  SaveDispensingPayload,
} from '../../api/pharmacy-dispensing';
import type { MedicineBatch } from '../../api/pharmacy-inventory';
import { hasPermission } from '../../auth/access-control';
import { useAuth } from '../../auth/useAuth';
import {
  usePharmacyDispensing,
  usePharmacyDispensingBatches,
  usePharmacyDispensingDetail,
} from '../usePharmacyDispensing';
import { useBranchesList } from '../branches/useBranches';
import {
  calculateDispensingLineTotal,
  calculateDispensingTotal,
} from '../../utils/pharmacy-dispensing';

export type PharmacyDispensingFilters = {
  requestedBranch: string;
  search: string;
  status: DispensingQueueStatus | '';
  page: number;
  limit: number;
  initialPrescriptionId?: string;
};

export type DispensingDraftLine = {
  id: string;
  prescriptionItemId: string;
  prescribedMedicineName: string;
  requestedQuantity: number | null;
  medicineId: string | null;
  selectedMedicineName: string;
  batchId: string | null;
  batchNumberSnapshot: string;
  availableQuantitySnapshot: number;
  unitPriceSnapshot: number;
  confirmedQuantity: number | null;
  pharmacistInstructions: string;
};

export type DispensingLineView = DispensingDraftLine & {
  batchNumber: string;
  availableQuantity: number;
  unitPrice: number;
  lineTotal: number;
  batchOptions: MedicineBatch[];
  insufficientStock: boolean;
  invalidQuantity: boolean;
};

const toDraftLine = (item: DispensingItem): DispensingDraftLine => ({
  id: item.id,
  prescriptionItemId: item.prescription_item_id,
  prescribedMedicineName: item.prescribed_medicine_name,
  requestedQuantity: item.requested_quantity,
  medicineId: item.medicine_id,
  selectedMedicineName: item.medicine_name,
  batchId: item.batch_id,
  batchNumberSnapshot: item.batch_number,
  availableQuantitySnapshot: item.available_quantity,
  unitPriceSnapshot: item.unit_price,
  confirmedQuantity: item.confirmed_quantity,
  pharmacistInstructions: item.pharmacist_instructions ?? '',
});

const dispensingErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'You do not have permission to perform this dispensing action.';
    if (error.code === 'INSUFFICIENT_STOCK') return error.message;
    if (error.code === 'STALE_VERSION') return 'This dispensing was changed by another user. Refresh and review it again.';
    if (error.status >= 500) return 'Unable to complete dispensing. Please try again or contact support if the problem continues.';
    return error.message;
  }
  return 'The dispensing request could not be completed. Please try again.';
};

export function usePharmacyDispensingFeature(filters: PharmacyDispensingFilters) {
  const { user } = useAuth();
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState(filters.initialPrescriptionId ?? '');
  const [draftLines, setDraftLines] = useState<DispensingDraftLine[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [actionError, setActionError] = useState('');
  const isSuperAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));

  const can = useCallback((action: string) => Boolean(
    isSuperAdmin || hasPermission(user?.permissions ?? [], { module: 'Pharmacy', screen: 'Dispensing', action }),
  ), [isSuperAdmin, user?.permissions]);

  const permissions = useMemo(() => ({
    canView: can('View'),
    canEdit: can('Edit'),
    canDispense: can('Dispense'),
    canCancel: can('Cancel'),
    canReverse: can('Reverse'),
  }), [can]);

  const branchesQuery = useBranchesList(
    { status: 'ACTIVE', page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' },
    isSuperAdmin,
  );
  const branches = useMemo(() => isSuperAdmin
    ? (branchesQuery.data?.data ?? []).map((branch) => ({ id: branch.id, code: branch.code, name: branch.name }))
    : user?.branches ?? [], [branchesQuery.data?.data, isSuperAdmin, user?.branches]);
  const activeBranchId = branches.some((branch) => branch.id === filters.requestedBranch)
    ? filters.requestedBranch
    : branches[0]?.id ?? '';

  const dispensingDomain = usePharmacyDispensing({
    branchId: activeBranchId,
    search: filters.search.trim(),
    status: filters.status || undefined,
    page: filters.page,
    limit: filters.limit,
    enabled: permissions.canView,
  });
  const pendingSummaryDomain = usePharmacyDispensing({
    branchId: activeBranchId,
    search: '',
    status: 'PENDING',
    page: 1,
    limit: 1,
    enabled: permissions.canView,
  });
  const confirmedSummaryDomain = usePharmacyDispensing({
    branchId: activeBranchId,
    search: '',
    status: 'CONFIRMED',
    page: 1,
    limit: 1,
    enabled: permissions.canView,
  });
  const detailQuery = usePharmacyDispensingDetail(selectedPrescriptionId, permissions.canView);
  const batchesQuery = usePharmacyDispensingBatches(
    { branch_id: activeBranchId, status: 'ACTIVE', page: 1, limit: 100, sortBy: 'expiry_date', sortOrder: 'asc' },
    Boolean(activeBranchId && selectedPrescriptionId && detailQuery.data?.status === 'DRAFT'),
  );

  useEffect(() => {
    if (!detailQuery.data) return;
    setDraftLines(detailQuery.data.items.map(toDraftLine));
    setIsDirty(false);
    setActionError('');
  }, [detailQuery.data]);

  const activeBatches = batchesQuery.data?.data ?? [];
  const isDraft = detailQuery.data?.status === 'DRAFT';
  const lines: DispensingLineView[] = useMemo(() => draftLines.map((line) => {
    const batchOptions = isDraft ? activeBatches.filter((batch) => batch.medicine_id === line.medicineId) : [];
    const batch = isDraft ? batchOptions.find((candidate) => candidate.id === line.batchId) : undefined;
    const availableQuantity = isDraft ? batch?.quantity_on_hand ?? 0 : line.availableQuantitySnapshot;
    const unitPrice = line.unitPriceSnapshot;
    const confirmedQuantity = line.confirmedQuantity ?? 0;
    const invalidQuantity = !Number.isInteger(line.confirmedQuantity) || confirmedQuantity <= 0;
    return {
      ...line,
      batchNumber: batch?.batch_number ?? line.batchNumberSnapshot,
      availableQuantity,
      unitPrice,
      lineTotal: calculateDispensingLineTotal(unitPrice, line.confirmedQuantity),
      batchOptions,
      insufficientStock: isDraft && (!batch || confirmedQuantity > availableQuantity),
      invalidQuantity,
    };
  }), [activeBatches, draftLines, isDraft]);
  const dispensingTotal = useMemo(() => calculateDispensingTotal(lines), [lines]);

  const updateLine = useCallback((id: string, update: (line: DispensingDraftLine) => DispensingDraftLine) => {
    setDraftLines((current) => current.map((line) => line.id === id ? update(line) : line));
    setIsDirty(true);
    setActionError('');
  }, []);

  const selectBatch = useCallback((id: string, batchId: string) => updateLine(id, (line) => {
    const batch = activeBatches.find((candidate) => candidate.id === batchId);
    return {
      ...line,
      batchId: batchId || null,
      batchNumberSnapshot: batch?.batch_number ?? '',
      availableQuantitySnapshot: batch?.quantity_on_hand ?? 0,
      unitPriceSnapshot: batch?.unit_price ?? 0,
    };
  }), [activeBatches, updateLine]);

  const setConfirmedQuantity = useCallback((id: string, quantity: number | null) => updateLine(id, (line) => ({
    ...line,
    confirmedQuantity: quantity,
  })), [updateLine]);

  const setInstructions = useCallback((id: string, instructions: string) => updateLine(id, (line) => ({
    ...line,
    pharmacistInstructions: instructions,
  })), [updateLine]);

  const buildPayload = useCallback((dispensing: Dispensing): SaveDispensingPayload | null => {
    const payloadItems: SaveDispensingPayload['items'] = [];
    for (const line of lines) {
      if (!line.medicineId) {
        setActionError(`Select a medicine for ${line.prescribedMedicineName}.`);
        return null;
      }
      if (!line.batchId) {
        setActionError(`Select an available batch for ${line.prescribedMedicineName}.`);
        return null;
      }
      if (!line.confirmedQuantity || !Number.isInteger(line.confirmedQuantity) || line.confirmedQuantity < 1) {
        setActionError(`Enter a valid final quantity for ${line.prescribedMedicineName}.`);
        return null;
      }
      if (!line.batchId) {
        setActionError('Please select a batch before confirming the dispensing.');
        return null;
      }
      if (line.insufficientStock) {
        setActionError('The selected batch does not have enough stock for the requested quantity.');
        return null;
      }
      payloadItems.push({
        prescription_item_id: line.prescriptionItemId,
        medicine_id: line.medicineId,
        batch_id: line.batchId,
        confirmed_quantity: line.confirmedQuantity,
        pharmacist_instructions: line.pharmacistInstructions.trim() || null,
      });
    }
    return { version: dispensing.version, items: payloadItems };
  }, [lines]);

  const saveCurrentDraft = useCallback(async (showSuccess: boolean) => {
    const dispensing = detailQuery.data;
    if (!dispensing || dispensing.status !== 'DRAFT') return null;
    const payload = buildPayload(dispensing);
    if (!payload) return null;
    try {
      const saved = await dispensingDomain.save.mutateAsync({ id: dispensing.prescription_id, payload });
      setDraftLines(saved.items.map(toDraftLine));
      setIsDirty(false);
      setActionError('');
      if (showSuccess) toast.success('Dispensing draft saved.');
      return saved;
    } catch (error) {
      const message = dispensingErrorMessage(error);
      setActionError(message);
      toast.error(message);
      return null;
    }
  }, [buildPayload, detailQuery.data, dispensingDomain.save]);

  const saveDraft = useCallback(async () => Boolean(await saveCurrentDraft(true)), [saveCurrentDraft]);

  const confirmDispensing = useCallback(async () => {
    const current = isDirty ? await saveCurrentDraft(false) : detailQuery.data;
    if (!current || current.status !== 'DRAFT') return false;
    if (!buildPayload(current)) return false;
    try {
      await dispensingDomain.confirm.mutateAsync({ id: current.prescription_id, version: current.version });
      setIsDirty(false);
      setActionError('');
      toast.success('Dispensing confirmed. Stock deducted and Pharmacy invoice created.');
      return true;
    } catch (error) {
      const message = dispensingErrorMessage(error);
      setActionError(message);
      toast.error(message);
      return false;
    }
  }, [buildPayload, detailQuery.data, dispensingDomain.confirm, isDirty, saveCurrentDraft]);

  const cancelDispensing = useCallback(async (reason: string) => {
    const dispensing = detailQuery.data;
    if (!dispensing || dispensing.status !== 'DRAFT') return false;
    if (reason.trim().length < 3) {
      setActionError('Enter a cancellation reason of at least 3 characters.');
      return false;
    }
    try {
      await dispensingDomain.cancel.mutateAsync({ id: dispensing.prescription_id, version: dispensing.version, reason: reason.trim() });
      setActionError('');
      toast.success('Dispensing cancelled. No stock was deducted.');
      return true;
    } catch (error) {
      const message = dispensingErrorMessage(error);
      setActionError(message);
      toast.error(message);
      return false;
    }
  }, [detailQuery.data, dispensingDomain.cancel]);

  const reverseDispensing = useCallback(async (reason: string) => {
    const dispensing = detailQuery.data;
    if (!dispensing || dispensing.status !== 'CONFIRMED') return false;
    if (reason.trim().length < 3) {
      setActionError('Enter a reversal reason of at least 3 characters.');
      return false;
    }
    try {
      await dispensingDomain.reverse.mutateAsync({ id: dispensing.prescription_id, version: dispensing.version, reason: reason.trim() });
      setActionError('');
      toast.success('Dispensing reversed. Stock restored and unpaid invoice cancelled.');
      return true;
    } catch (error) {
      const message = dispensingErrorMessage(error);
      setActionError(message);
      toast.error(message);
      return false;
    }
  }, [detailQuery.data, dispensingDomain.reverse]);

  const openDispensing = useCallback((prescriptionId: string) => {
    setSelectedPrescriptionId(prescriptionId);
    setActionError('');
  }, []);

  const closeDispensing = useCallback(() => {
    setSelectedPrescriptionId('');
    setDraftLines([]);
    setIsDirty(false);
    setActionError('');
  }, []);

  const dispensings = dispensingDomain.listQuery.data?.data ?? [];
  const isMutating = dispensingDomain.save.isPending || dispensingDomain.confirm.isPending || dispensingDomain.cancel.isPending || dispensingDomain.reverse.isPending;

  return {
    branches,
    activeBranchId,
    permissions,
    dispensings,
    meta: dispensingDomain.listQuery.data?.meta,
    pendingCount: pendingSummaryDomain.listQuery.data?.meta.total ?? null,
    confirmedCount: confirmedSummaryDomain.listQuery.data?.meta.total ?? null,
    summaryLoading: pendingSummaryDomain.listQuery.isLoading || confirmedSummaryDomain.listQuery.isLoading,
    summaryError: pendingSummaryDomain.listQuery.isError || confirmedSummaryDomain.listQuery.isError,
    listLoading: dispensingDomain.listQuery.isLoading || branchesQuery.isLoading,
    listError: dispensingDomain.listQuery.error ? dispensingErrorMessage(dispensingDomain.listQuery.error) : '',
    refetch: dispensingDomain.listQuery.refetch,
    selectedPrescriptionId,
    detail: detailQuery.data ?? null,
    detailLoading: detailQuery.isLoading,
    detailError: detailQuery.error ? dispensingErrorMessage(detailQuery.error) : '',
    actionError,
    isDirty,
    isMutating,
    batchesLoading: batchesQuery.isLoading,
    lines,
    dispensingTotal,
    actions: {
      openDispensing,
      closeDispensing,
      selectBatch,
      setConfirmedQuantity,
      setInstructions,
      saveDraft,
      confirmDispensing,
      cancelDispensing,
      reverseDispensing,
    },
  };
}
