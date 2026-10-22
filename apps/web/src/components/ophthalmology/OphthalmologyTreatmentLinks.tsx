import type { ClinicalReviewWrite } from '../../api/ophthalmology-care';
import type { CareWorkspace } from '../../hooks/ophthalmology/useOphthalmologyCareFeature';
import { useOphthalmologyTreatmentLinksFeature } from '../../hooks/ophthalmology/useOphthalmologyTreatmentLinksFeature';

type Plan = ClinicalReviewWrite['treatment_plans'][number];
type LinkKey = 'medication_prescription_id' | 'procedure_recommendation_id' | 'referral_id' | 'follow_up_id';
export function OphthalmologyTreatmentLinks({ workspace, values, onSelect, onOrders }: {
  workspace: CareWorkspace; values: Pick<Plan, LinkKey | 'clinical_order_ids'>;
  onSelect: (key: LinkKey, value: string | null) => void; onOrders: (ids: string[]) => void;
}) {
  const f = useOphthalmologyTreatmentLinksFeature(workspace, true);
  const choices: Array<{ key: LinkKey; label: string; records: Array<{ id: string; status?: string }> }> = [
    { key: 'medication_prescription_id', label: 'Medication request', records: f.data?.medication_prescriptions ?? [] },
    { key: 'procedure_recommendation_id', label: 'Procedure recommendation', records: f.data?.procedure_recommendations ?? [] },
    { key: 'referral_id', label: 'Referral', records: f.data?.referrals ?? [] },
    { key: 'follow_up_id', label: 'Follow-up', records: f.data?.follow_ups ?? [] },
  ];
  return <section aria-label="Saved encounter care references"><p>Select source records already saved for this encounter. Linking a record does not submit, schedule or fulfill it.</p>
    <button type="button" className="doc-btn" disabled={!f.enabled || f.query.isFetching} onClick={() => void f.refresh()}>Refresh care references</button>
    {f.query.isLoading && <p role="status">Loading encounter care references…</p>}
    {(f.query.isError || f.invalid) && <p role="alert">Care references could not be verified for this encounter. Refresh to retry; saved selections are retained.</p>}
    <fieldset className="oph-fieldset" disabled={!f.ready}>
      {choices.map(({ key, label, records }) => <label className="doc-field" key={key}>{label}<select value={values[key] ?? ''} onChange={(event) => onSelect(key, event.target.value || null)}>
        <option value="">Not linked</option>{values[key] && !records.some((record) => record.id === values[key]) && <option value={values[key]}>Saved reference {values[key]} — unavailable</option>}
        {records.map((record) => <option key={record.id} value={record.id}>{record.id} · {record.status ?? 'Unknown'}</option>)}
      </select></label>)}
      <label className="doc-field">Laboratory / imaging orders<select multiple value={values.clinical_order_ids ?? []} onChange={(event) => onOrders(Array.from(event.target.selectedOptions, (option) => option.value))}>
        {(values.clinical_order_ids ?? []).filter((value) => !f.data?.clinical_orders.some((record) => record.id === value)).map((value) => <option key={value} value={value}>Saved reference {value} — unavailable</option>)}
        {f.data?.clinical_orders.map((record) => <option key={record.id} value={record.id}>{record.order_type} · {record.status ?? 'Unknown'} · {record.id}</option>)}
      </select></label>
    </fieldset>
  </section>;
}
