import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../auth/useAuth';
import {
  useEnterImagingReport,
  useImagingOrderDetails,
  useImagingReport,
  useUpdateImagingReport,
} from '../hooks/imaging/useImaging';
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
  const id = new URLSearchParams(location.search).get('id') ?? '';
  const orderQuery = useImagingOrderDetails(id || null);
  const hasReport = ['REPORT_ENTERED', 'VERIFIED', 'COMPLETED'].includes(orderQuery.data?.status ?? '');
  const reportQuery = useImagingReport(id || null, hasReport);
  const enterReport = useEnterImagingReport();
  const updateReport = useUpdateImagingReport();
  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { findings: '', impression: '', recommendations: '' } });
  useEffect(() => { if (reportQuery.data) form.reset({ findings: reportQuery.data.findings, impression: reportQuery.data.impression, recommendations: reportQuery.data.recommendations ?? '' }); }, [form, reportQuery.data]);
  const readOnly = ['VERIFIED', 'COMPLETED'].includes(orderQuery.data?.status ?? '');
  const canEnterReport = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN') || user?.permissions.some((permission) =>
    permission.module.toLowerCase() === 'imaging' && permission.screen.toLowerCase() === 'orders' && permission.action.toLowerCase() === 'enterreport',
  ));
  const saveReport = (values: FormData) => {
    const variables = {
      id,
      payload: { ...values, recommendations: values.recommendations || null },
    };
    const options = { onSuccess: () => navigate(`/imaging/workspace?id=${id}`) };
    if (orderQuery.data?.status === 'IN_PROGRESS') {
      enterReport.mutate(variables, options);
      return;
    }
    updateReport.mutate(variables, options);
  };
  const isSaving = enterReport.isPending || updateReport.isPending;
  if (!id) return <div className="diagnostic-empty card"><h3>Select an imaging order</h3><button className="btn-primary" onClick={() => navigate('/imaging/queue')}>Open Work Queue</button></div>;
  if (orderQuery.isLoading || (hasReport && reportQuery.isLoading)) return <div className="diagnostic-empty card"><span className="loading-spinner" /> Loading report workspace...</div>;
  if (orderQuery.isError || !orderQuery.data || (hasReport && reportQuery.isError)) return <div className="diagnostic-empty card" role="alert"><i className="ph ph-warning" /><h3>Report workspace unavailable</h3><button className="btn-secondary" onClick={() => navigate('/imaging/queue')}>Return to Queue</button></div>;
  const canEdit = ['IN_PROGRESS', 'REPORT_ENTERED'].includes(orderQuery.data.status);
  return <div className="diagnostic-page imaging"><section className="diagnostic-order-header card"><div><span className="eyebrow">Imaging report</span><h2>{orderQuery.data.patient_name}</h2><p>{orderQuery.data.patient_number} · {orderQuery.data.items.map((item) => item.service_name).join(', ')}</p></div><span className={`diagnostic-status status-${orderQuery.data.status.toLowerCase().replaceAll('_', '-')}`}>{orderQuery.data.status.replaceAll('_', ' ')}</span></section>
    <form className="card diagnostic-panel diagnostic-report-form" onSubmit={form.handleSubmit(saveReport)}>
      <div className="form-section-title">Radiology Report</div>
      <label className="form-field"><span>Findings <span className="required">*</span></span><textarea disabled={readOnly} rows={9} {...form.register('findings')} />{form.formState.errors.findings ? <small className="field-error">{form.formState.errors.findings.message}</small> : null}</label>
      <label className="form-field"><span>Impression <span className="required">*</span></span><textarea disabled={readOnly} rows={6} {...form.register('impression')} />{form.formState.errors.impression ? <small className="field-error">{form.formState.errors.impression.message}</small> : null}</label>
      <label className="form-field"><span>Recommendations</span><textarea disabled={readOnly} rows={4} {...form.register('recommendations')} /></label>
      {readOnly ? <div className="diagnostic-readonly"><i className="ph ph-seal-check" /> This report is verified and read-only.</div> : null}
      {!canEdit ? <div className="diagnostic-readonly"><i className="ph ph-info" /> A report can be entered only after the order is in progress.</div> : null}
      <div className="diagnostic-form-actions"><button className="btn-secondary" type="button" onClick={() => navigate(`/imaging/workspace?id=${id}`)}>Back</button>{canEdit && !readOnly ? <button className="btn-primary" disabled={isSaving || !canEnterReport} type="submit">{isSaving ? 'Saving...' : 'Save Report'}</button> : null}</div>
    </form>
  </div>;
}
