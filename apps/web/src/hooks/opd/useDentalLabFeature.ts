import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import type { SaveOpdClinicalOrderPayload } from '../../api/opd';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { getOpdErrorMessage } from '../../pages/opd-utils';
import { navigate, useAppLocation } from '../../routing/navigation';
import { useServicesList } from '../services/useServices';
import { useLaboratoryResult } from '../laboratory/useLaboratory';
import { useOpdClinicalOrder, useSaveOpdClinicalOrderDraft, useSubmitOpdClinicalOrder } from './useOpd';

const requestSchema = z.object({
  serviceId: z.string().regex(/^[a-f\d]{24}$/i, 'Select a laboratory service'),
  specimenType: z.string().optional(),
});
type RequestValues = z.infer<typeof requestSchema>;

export type DentalLabFeatureInput = {
  visitId: string;
  active: boolean;
  canEdit: boolean;
  consultationCompleted: boolean;
  draft: SaveOpdClinicalOrderPayload;
};

export function useDentalLabFeature(input: DentalLabFeatureInput) {
  const { user } = useAuth();
  const canView = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN')) ||
    hasPermission(user?.permissions ?? [], { module: 'OPD', screen: 'OPD Clinical Orders', action: 'View' }, user?.roles ?? []) ||
    hasPermission(user?.permissions ?? [], { module: 'OPD', screen: 'OPD Consultation', action: 'View' }, user?.roles ?? []);
  const [open, setOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [saveError, setSaveError] = useState('');
  const { pathname, search } = useAppLocation();
  const params = new URLSearchParams(search);
  const searchTerm = params.get('dentalLabSearch') ?? '';
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);
  const rawPage = Number(params.get('dentalLabPage') ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const order = useOpdClinicalOrder(input.visitId, 'LABORATORY', input.active && canView);
  const catalogue = useServicesList(
    { service_type: 'LAB_TEST', status: 'ACTIVE', search: debouncedSearch, page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' },
    input.active && canView && input.canEdit && open,
  );
  const save = useSaveOpdClinicalOrderDraft({ notifyOnError: false });
  const submit = useSubmitOpdClinicalOrder({ notifyOnError: false, notifyOnSuccess: false });
  const resultAvailable = Boolean(order.data && ['RESULT_ENTERED', 'VERIFIED', 'COMPLETED'].includes(order.data.status));
  const result = useLaboratoryResult(order.data?.id ?? null, input.active && canView && resultOpen && resultAvailable);
  const form = useForm<RequestValues>({ resolver: zodResolver(requestSchema), defaultValues: { serviceId: '', specimenType: 'Blood' } });
  const canAdd = input.canEdit && !input.consultationCompleted && canView && (!order.data || order.data.status !== 'COMPLETED');

  const changeSearch = (value: string) => {
    const next = new URLSearchParams(search);
    if (value) next.set('dentalLabSearch', value); else next.delete('dentalLabSearch');
    next.delete('dentalLabPage');
    navigate(`${pathname}?${next}`, { replace: true });
  };
  const openRequest = () => {
    if (!canAdd) return;
    form.reset({ serviceId: '', specimenType: input.draft.specimen_type || 'Blood' });
    setSaveError('');
    setOpen(true);
  };
  const saveRequest = form.handleSubmit(async ({ serviceId, specimenType }) => {
    if (!canAdd || save.isPending) return;
    const service = catalogue.data?.data.find((item) => item.id === serviceId);
    if (!service || service.service_type !== 'LAB_TEST' || service.status !== 'ACTIVE') {
      form.setError('serviceId', { message: 'Select an available laboratory service' });
      return;
    }
    if (input.draft.items.some((item) => item.service_id === serviceId)) {
      form.setError('serviceId', { message: 'This service is already in the visit laboratory order.' });
      return;
    }
    setSaveError('');
    try {
      await save.mutateAsync({
        visitId: input.visitId,
        type: 'LABORATORY',
        payload: {
          ...input.draft,
          expected_updated_at: order.data?.updated_at ?? undefined,
          specimen_type: specimenType?.trim() || 'Blood',
          items: [
            ...input.draft.items,
            {
              service_id: service.id,
              investigation_name: service.name,
              category: service.category || 'Laboratory',
              tooth_number: null,
            },
          ],
        },
      });
      toast.success('Laboratory request saved. Submit after completing the consultation.');
      setOpen(false);
    } catch (error) {
      const message = getOpdErrorMessage(error);
      setSaveError(message);
      toast.error(message);
    }
  });
  const submitRequest = async () => {
    if (!input.consultationCompleted || !input.canEdit || !canView || order.data?.status !== 'DRAFT') return;
    try {
      await submit.mutateAsync({
        visitId: input.visitId,
        type: 'LABORATORY',
        payload: {
          ...input.draft,
          expected_updated_at: order.data.updated_at,
        },
      });
      toast.success('Laboratory request submitted to Laboratory.');
    } catch (error) {
      setSaveError(getOpdErrorMessage(error));
      toast.error(getOpdErrorMessage(error));
    }
  };
  return {
    canView,
    canAdd,
    open,
    setOpen,
    form,
    openRequest,
    saveRequest,
    saveError,
    order,
    catalogue,
    result,
    resultAvailable,
    resultOpen,
    setResultOpen,
    searchTerm,
    page,
    changeSearch,
    saving: save.isPending || submit.isPending,
    submitRequest,
  };
}

export type DentalLabFeature = ReturnType<typeof useDentalLabFeature>;
