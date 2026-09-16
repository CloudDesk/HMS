import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import type { SaveOpdClinicalOrderPayload } from '../../api/opd';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { isValidFdiTooth } from '../../pages/dental-utils';
import { getOpdErrorMessage } from '../../pages/opd-utils';
import { navigate, useAppLocation } from '../../routing/navigation';
import { useServicesList } from '../services/useServices';
import { useImagingReport } from '../imaging/useImaging';
import { useOpdClinicalOrder, useSaveOpdClinicalOrderDraft, useSubmitOpdClinicalOrder } from './useOpd';

const requestSchema = z.object({
  serviceId: z.string().regex(/^[a-f\d]{24}$/i, 'Select an imaging service'),
  tooth: z.string().refine((value) => value === '' || isValidFdiTooth(Number(value)), 'Select a valid FDI tooth'),
});
type RequestValues = z.infer<typeof requestSchema>;

export type DentalImagingFeatureInput = {
  visitId: string;
  active: boolean;
  canEdit: boolean;
  consultationCompleted: boolean;
  draft: SaveOpdClinicalOrderPayload;
};

export function useDentalImagingFeature(input: DentalImagingFeatureInput) {
  const { user } = useAuth();
  const canView = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN')) ||
    hasPermission(user?.permissions ?? [], { module: 'OPD', screen: 'OPD Clinical Orders', action: 'View' }, user?.roles ?? []) ||
    hasPermission(user?.permissions ?? [], { module: 'OPD', screen: 'OPD Consultation', action: 'View' }, user?.roles ?? []);
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [saveError, setSaveError] = useState('');
  const { pathname, search } = useAppLocation();
  const params = new URLSearchParams(search);
  const searchTerm = params.get('dentalImagingSearch') ?? '';
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);
  const rawPage = Number(params.get('dentalImagingPage') ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const order = useOpdClinicalOrder(input.visitId, 'IMAGING', input.active && canView);
  const catalogue = useServicesList(
    { service_type: 'IMAGING_SERVICE', status: 'ACTIVE', search: debouncedSearch, page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' },
    input.active && canView && input.canEdit && open,
  );
  const save = useSaveOpdClinicalOrderDraft({ notifyOnError: false });
  const submit = useSubmitOpdClinicalOrder({ notifyOnError: false, notifyOnSuccess: false });
  const reportAvailable = Boolean(order.data && ['REPORT_ENTERED', 'VERIFIED', 'COMPLETED'].includes(order.data.status));
  const report = useImagingReport(order.data?.id ?? null, input.active && canView && reportOpen && reportAvailable);
  const form = useForm<RequestValues>({ resolver: zodResolver(requestSchema), defaultValues: { serviceId: '', tooth: '' } });
  const canAdd = input.canEdit && !input.consultationCompleted && canView && (!order.data || order.data.status !== 'COMPLETED');

  const changeSearch = (value: string) => {
    const next = new URLSearchParams(search);
    if (value) next.set('dentalImagingSearch', value); else next.delete('dentalImagingSearch');
    next.delete('dentalImagingPage');
    navigate(`${pathname}?${next}`, { replace: true });
  };
  const openRequest = (tooth: number | null) => {
    if (!canAdd) return;
    form.reset({ serviceId: '', tooth: tooth === null ? '' : String(tooth) });
    setSaveError('');
    setOpen(true);
  };
  const saveRequest = form.handleSubmit(async ({ serviceId, tooth }) => {
    if (!canAdd || save.isPending) return;
    const service = catalogue.data?.data.find((item) => item.id === serviceId);
    if (!service || service.service_type !== 'IMAGING_SERVICE' || service.status !== 'ACTIVE') {
      form.setError('serviceId', { message: 'Select an available imaging service' });
      return;
    }
    if (input.draft.items.some((item) => item.service_id === serviceId)) {
      form.setError('serviceId', { message: 'This service is already in the visit imaging order. Review its tooth association in Imaging Orders.' });
      return;
    }
    setSaveError('');
    try {
      await save.mutateAsync({ visitId: input.visitId, type: 'IMAGING', payload: {
        ...input.draft,
        expected_updated_at: order.data?.updated_at ?? undefined,
        items: [...input.draft.items, { service_id: service.id, investigation_name: service.name,
          category: service.category || 'Imaging', tooth_number: tooth ? Number(tooth) : null }],
      } });
      toast.success('Imaging request saved. Submit after completing the consultation.');
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
      await submit.mutateAsync({ visitId: input.visitId, type: 'IMAGING', payload: {
        ...input.draft, expected_updated_at: order.data.updated_at,
      } });
      toast.success('Imaging request submitted to Radiology.');
    } catch (error) { setSaveError(getOpdErrorMessage(error)); toast.error(getOpdErrorMessage(error)); }
  };
  return { canView, canAdd, open, setOpen, form, openRequest, saveRequest, saveError,
    order, catalogue, report, reportAvailable, reportOpen, setReportOpen,
    searchTerm, page, changeSearch, saving: save.isPending || submit.isPending, submitRequest };
}

export type DentalImagingFeature = ReturnType<typeof useDentalImagingFeature>;
