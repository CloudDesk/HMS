import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiError } from '../api/api-error';
import { imagingApi } from '../api/imaging';
import { useAuth } from '../auth/useAuth';
import { navigate, useAppLocation } from '../routing/navigation';

const schema = z.object({
  findings: z.string().trim().min(1, 'Findings are required.').max(10000),
  impression: z.string().trim().min(1, 'Impression is required.').max(5000),
  recommendations: z.string().max(5000),
});
type FormData = z.infer<typeof schema>;

export function ImagingReportEntryPage() {
  const { user } = useAuth();
  const location = useAppLocation();
  const queryClient = useQueryClient();
  const id = new URLSearchParams(location.search).get('id') ?? '';
  const orderQuery = useQuery({ queryKey: ['imaging', 'order', id], queryFn: () => imagingApi.get(id), enabled: Boolean(id) });
  const hasReport = ['REPORT_ENTERED', 'VERIFIED', 'COMPLETED'].includes(orderQuery.data?.status ?? '');
  const reportQuery = useQuery({ queryKey: ['imaging', 'report', id], queryFn: () => imagingApi.getReport(id), enabled: Boolean(id && hasReport) });
  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { findings: '', impression: '', recommendations: '' } });
  useEffect(() => { if (reportQuery.data) form.reset({ findings: reportQuery.data.findings, impression: reportQuery.data.impression, recommendations: reportQuery.data.recommendations ?? '' }); }, [form, reportQuery.data]);
  const readOnly = ['VERIFIED', 'COMPLETED'].includes(orderQuery.data?.status ?? '');
  const canEnterReport = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN') || user?.permissions.some((permission) =>
    permission.module.toLowerCase() === 'imaging' && permission.screen.toLowerCase() === 'orders' && permission.action.toLowerCase() === 'enterreport',
  ));
  const mutation = useMutation({
    mutationFn: (values: FormData) => orderQuery.data?.status === 'IN_PROGRESS'
      ? imagingApi.enterReport(id, { ...values, recommendations: values.recommendations || null })
      : imagingApi.updateReport(id, { ...values, recommendations: values.recommendations || null }),
    onSuccess: async () => { toast.success('Imaging report saved.'); await queryClient.invalidateQueries({ queryKey: ['imaging'] }); navigate(`/imaging/workspace?id=${id}`); },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Unable to save imaging report.'),
  });
  if (!id) return <div className="diagnostic-empty card"><h3>Select an imaging order</h3><button className="btn-primary" onClick={() => navigate('/imaging/queue')}>Open Work Queue</button></div>;
  if (orderQuery.isLoading || (hasReport && reportQuery.isLoading)) return <div className="diagnostic-empty card"><span className="loading-spinner" /> Loading report workspace...</div>;
  if (orderQuery.isError || !orderQuery.data || (hasReport && reportQuery.isError)) return <div className="diagnostic-empty card" role="alert"><i className="ph ph-warning" /><h3>Report workspace unavailable</h3><button className="btn-secondary" onClick={() => navigate('/imaging/queue')}>Return to Queue</button></div>;
  const canEdit = ['IN_PROGRESS', 'REPORT_ENTERED'].includes(orderQuery.data.status);
  return <div className="diagnostic-page imaging"><section className="diagnostic-order-header card"><div><span className="eyebrow">Imaging report</span><h2>{orderQuery.data.patient_name}</h2><p>{orderQuery.data.patient_number} · {orderQuery.data.items.map((item) => item.service_name).join(', ')}</p></div><span className={`diagnostic-status status-${orderQuery.data.status.toLowerCase().replaceAll('_', '-')}`}>{orderQuery.data.status.replaceAll('_', ' ')}</span></section>
    <form className="card diagnostic-panel diagnostic-report-form" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <div className="form-section-title">Radiology Report</div>
      <label className="form-field"><span>Findings <span className="required">*</span></span><textarea disabled={readOnly} rows={9} {...form.register('findings')} />{form.formState.errors.findings ? <small className="field-error">{form.formState.errors.findings.message}</small> : null}</label>
      <label className="form-field"><span>Impression <span className="required">*</span></span><textarea disabled={readOnly} rows={6} {...form.register('impression')} />{form.formState.errors.impression ? <small className="field-error">{form.formState.errors.impression.message}</small> : null}</label>
      <label className="form-field"><span>Recommendations</span><textarea disabled={readOnly} rows={4} {...form.register('recommendations')} /></label>
      {readOnly ? <div className="diagnostic-readonly"><i className="ph ph-seal-check" /> This report is verified and read-only.</div> : null}
      {!canEdit ? <div className="diagnostic-readonly"><i className="ph ph-info" /> A report can be entered only after the order is in progress.</div> : null}
      <div className="diagnostic-form-actions"><button className="btn-secondary" type="button" onClick={() => navigate(`/imaging/workspace?id=${id}`)}>Back</button>{canEdit && !readOnly ? <button className="btn-primary" disabled={mutation.isPending || !canEnterReport} type="submit">{mutation.isPending ? 'Saving...' : 'Save Report'}</button> : null}</div>
    </form>
  </div>;
}
