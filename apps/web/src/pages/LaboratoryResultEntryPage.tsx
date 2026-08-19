import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useLaboratoryResultFeature } from '../hooks/laboratory/useLaboratoryResultFeature';
import { navigate } from '../routing/navigation';

const schema = z.object({
  result_items: z.array(z.object({
    service_id: z.string(), service_name: z.string(), value: z.string().trim().min(1, 'Result value is required.').max(500, 'Result value is too long'),
    unit: z.string().max(100), reference_range: z.string().max(200), comments: z.string().max(1000),
  })).min(1),
  remarks: z.string().max(2000),
});
type FormData = z.infer<typeof schema>;

export function LaboratoryResultEntryPage() {
  const feature = useLaboratoryResultFeature();
  const { id, order, result, isLoading, isError, isSaving, readOnly, canEdit, canEnterResult, actions } = feature;

  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { result_items: [], remarks: '' } });
  const fields = useFieldArray({ control: form.control, name: 'result_items' });

  useEffect(() => {
    if (!order) return;
    if (result) {
      form.reset({
        result_items: result.result_items.map((item) => ({
          service_id: item.service_id, service_name: item.service_name, value: item.value,
          unit: item.unit ?? '', reference_range: item.reference_range ?? '', comments: item.comments ?? '',
        })),
        remarks: result.remarks ?? ''
      });
    } else if (order.status === 'IN_PROGRESS') {
      form.reset({
        result_items: order.items.map((item) => ({
          service_id: item.service_id, service_name: item.service_name, value: '', unit: '', reference_range: '', comments: '',
        })),
        remarks: ''
      });
    }
  }, [form, order, result]);

  const saveResult = (values: FormData) => {
    actions.saveResult({
      result_items: values.result_items.map((item) => ({
        ...item,
        unit: item.unit || null,
        reference_range: item.reference_range || null,
        comments: item.comments || null,
      })),
      remarks: values.remarks || null,
    });
  };

  if (!id) return <div className="diagnostic-empty card"><h3>Select a laboratory order</h3><button className="btn-primary" onClick={() => navigate('/laboratory/queue')}>Open Work Queue</button></div>;
  if (isLoading) return <div className="diagnostic-empty card"><span className="loading-spinner" /> Loading result workspace...</div>;
  if (isError || !order) return <div className="diagnostic-empty card" role="alert"><i className="ph ph-warning" /><h3>Result workspace unavailable</h3><button className="btn-secondary" onClick={() => navigate('/laboratory/queue')}>Return to Queue</button></div>;

  return <div className="diagnostic-page laboratory">
    <section className="diagnostic-order-header card">
      <div>
        <span className="eyebrow">Laboratory results</span>
        <h2>{order.patient_name}</h2>
        <p>{order.patient_number} — {order.doctor_name}</p>
      </div>
      <span className={`diagnostic-status status-${order.status.toLowerCase().replaceAll('_', '-')}`}>{order.status.replaceAll('_', ' ')}</span>
    </section>

    <form className="card diagnostic-panel" onSubmit={form.handleSubmit(saveResult)}>
      <div className="form-section-title">Result Entry</div>
      <div className="table-responsive">
        <table className="data-table diagnostic-result-table">
          <thead><tr><th>Service</th><th>Value</th><th>Unit</th><th>Reference Range</th><th>Comments</th></tr></thead>
          <tbody>
            {fields.fields.map((field, index) => <tr key={field.id}>
              <td>
                <strong>{field.service_name}</strong>
                <input type="hidden" {...form.register(`result_items.${index}.service_id`)} />
                <input type="hidden" {...form.register(`result_items.${index}.service_name`)} />
              </td>
              <td>
                <input disabled={readOnly} {...form.register(`result_items.${index}.value`)} />
                {form.formState.errors.result_items?.[index]?.value ? <small className="field-error">{form.formState.errors.result_items[index]?.value?.message}</small> : null}
              </td>
              <td><input disabled={readOnly} {...form.register(`result_items.${index}.unit`)} /></td>
              <td><input disabled={readOnly} {...form.register(`result_items.${index}.reference_range`)} /></td>
              <td><input disabled={readOnly} {...form.register(`result_items.${index}.comments`)} /></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <label className="form-field"><span>Remarks</span><textarea disabled={readOnly} rows={4} {...form.register('remarks')} /></label>

      {readOnly ? <div className="diagnostic-readonly"><i className="ph ph-seal-check" /> This result is verified and read-only.</div> : null}
      {!canEdit ? <div className="diagnostic-readonly"><i className="ph ph-info" /> Results can be entered only after the order is in progress.</div> : null}

      <div className="diagnostic-form-actions">
        <button className="btn-secondary" type="button" onClick={() => navigate(`/laboratory/workspace?id=${id}`)}>Back</button>
        {canEdit && !readOnly ? <button className="btn-primary" disabled={isSaving || !canEnterResult} type="submit">{isSaving ? 'Saving...' : 'Save Results'}</button> : null}
      </div>
    </form>
  </div>;
}
