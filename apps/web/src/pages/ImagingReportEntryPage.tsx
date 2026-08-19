import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useImagingReportFeature } from '../hooks/imaging/useImagingReportFeature';
import { navigate } from '../routing/navigation';

const schema = z.object({
  findings: z.string().trim().min(1, 'Findings are required.').max(10000),
  impression: z.string().trim().min(1, 'Impression is required.').max(5000),
  recommendations: z.string().max(5000),
});
type FormData = z.infer<typeof schema>;

export function ImagingReportEntryPage() {
  const feature = useImagingReportFeature();
  const { id, order, report, isLoading, isError, isSaving, readOnly, canEdit, canEnterReport, actions } = feature;

  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { findings: '', impression: '', recommendations: '' } });

  useEffect(() => {
    if (report) {
      form.reset({
        findings: report.findings,
        impression: report.impression,
        recommendations: report.recommendations ?? ''
      });
    }
  }, [form, report]);

  const saveReport = (values: FormData) => {
    actions.saveReport({
      ...values,
      recommendations: values.recommendations || null,
    });
  };

  if (!id) return <div className="diagnostic-empty card"><h3>Select an imaging order</h3><button className="btn-primary" onClick={() => navigate('/imaging/queue')}>Open Work Queue</button></div>;
  if (isLoading) return <div className="diagnostic-empty card"><span className="loading-spinner" /> Loading report workspace...</div>;
  if (isError || !order) return <div className="diagnostic-empty card" role="alert"><i className="ph ph-warning" /><h3>Report workspace unavailable</h3><button className="btn-secondary" onClick={() => navigate('/imaging/queue')}>Return to Queue</button></div>;

  return <div className="diagnostic-page imaging">
    <section className="diagnostic-order-header card">
      <div>
        <span className="eyebrow">Imaging report</span>
        <h2>{order.patient_name}</h2>
        <p>{order.patient_number} — {order.items.map((item) => item.service_name).join(', ')}</p>
      </div>
      <span className={`diagnostic-status status-${order.status.toLowerCase().replaceAll('_', '-')}`}>{order.status.replaceAll('_', ' ')}</span>
    </section>

    <form className="card diagnostic-panel diagnostic-report-form" onSubmit={form.handleSubmit(saveReport)}>
      <div className="form-section-title">Radiology Report</div>
      <label className="form-field">
        <span>Findings <span className="required">*</span></span>
        <textarea disabled={readOnly} rows={9} {...form.register('findings')} />
        {form.formState.errors.findings ? <small className="field-error">{form.formState.errors.findings.message}</small> : null}
      </label>
      <label className="form-field">
        <span>Impression <span className="required">*</span></span>
        <textarea disabled={readOnly} rows={6} {...form.register('impression')} />
        {form.formState.errors.impression ? <small className="field-error">{form.formState.errors.impression.message}</small> : null}
      </label>
      <label className="form-field">
        <span>Recommendations</span>
        <textarea disabled={readOnly} rows={4} {...form.register('recommendations')} />
      </label>

      {readOnly ? <div className="diagnostic-readonly"><i className="ph ph-seal-check" /> This report is verified and read-only.</div> : null}
      {!canEdit ? <div className="diagnostic-readonly"><i className="ph ph-info" /> A report can be entered only after the order is in progress.</div> : null}

      <div className="diagnostic-form-actions">
        <button className="btn-secondary" type="button" onClick={() => navigate(`/imaging/workspace?id=${id}`)}>Back</button>
        {canEdit && !readOnly ? <button className="btn-primary" disabled={isSaving || !canEnterReport} type="submit">{isSaving ? 'Saving...' : 'Save Report'}</button> : null}
      </div>
    </form>
  </div>;
}
