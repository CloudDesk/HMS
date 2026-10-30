import type { ClinicalReviewWrite } from '../../api/ophthalmology-care';
import { useOphthalmologyTreatmentLinksFeature, type TreatmentLinksWorkspace } from '../../hooks/ophthalmology/useOphthalmologyTreatmentLinksFeature';

type Plan = ClinicalReviewWrite['treatment_plans'][number];
type LinkKey = 'medication_prescription_id' | 'optical_prescription_id' | 'procedure_recommendation_id' | 'referral_id' | 'follow_up_id';
type LinkedAction = Exclude<Plan['action_type'], 'OTHER' | 'INVESTIGATION'>;
const actionConfig: Record<LinkedAction, { key: LinkKey; label: string; empty: string }> = {
  MEDICATION: { key: 'medication_prescription_id', label: 'Saved medication prescription', empty: 'No medication prescription is available for this encounter.' },
  OPTICAL: { key: 'optical_prescription_id', label: 'Saved optical prescription', empty: 'No optical prescription is available for this encounter.' },
  PROCEDURE: { key: 'procedure_recommendation_id', label: 'Saved procedure recommendation', empty: 'No procedure recommendation is available for this encounter.' },
  REFERRAL: { key: 'referral_id', label: 'Saved referral', empty: 'No referral is available for this encounter.' },
  FOLLOW_UP: { key: 'follow_up_id', label: 'Saved follow-up', empty: 'No follow-up is available for this encounter.' },
};
export function OphthalmologyTreatmentLinks({
  workspace,
  actionType,
  values,
  onSelect,
  onOrders,
  onCreateProcedure,
  isRoutineBlocked,
}: {
  workspace: TreatmentLinksWorkspace;
  actionType: Plan['action_type'] | '';
  values: Pick<Plan, LinkKey | 'clinical_order_ids'>;
  onSelect: (key: LinkKey, value: string | null) => void;
  onOrders: (ids: string[]) => void;
  onCreateProcedure?: () => void;
  isRoutineBlocked?: boolean;
}) {
  const linked = Boolean(actionType && actionType !== 'OTHER');
  const f = useOphthalmologyTreatmentLinksFeature(workspace, linked);
  if (!actionType) return <section aria-label="Saved encounter care references"><p>Select an action before choosing a saved care record.</p></section>;
  if (actionType === 'OTHER') return <section aria-label="Saved encounter care references"><p>Other treatment is narrative-only and has no downstream record.</p></section>;
  const records = actionType === 'MEDICATION' ? f.data?.medication_prescriptions ?? []
    : actionType === 'OPTICAL' ? f.data?.optical_prescription ? [f.data.optical_prescription] : []
      : actionType === 'PROCEDURE' ? f.data?.procedure_recommendations ?? []
        : actionType === 'REFERRAL' ? f.data?.referrals ?? [] : actionType === 'FOLLOW_UP' ? f.data?.follow_ups ?? [] : [];
  const config = actionType === 'INVESTIGATION' ? null : actionConfig[actionType];
  return <section aria-label="Saved encounter care references"><p>Select the saved source record for this action. Linking it does not submit, schedule, approve, dispense or fulfill it.</p>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
      <button type="button" className="doc-btn" disabled={!f.enabled || f.query.isFetching} onClick={() => void f.refresh()}>Refresh care references</button>
      {actionType === 'PROCEDURE' && onCreateProcedure && (
        <button
          type="button"
          className="doc-btn primary"
          style={{ fontSize: '0.8rem', background: '#4f46e5', borderColor: '#4338ca', padding: '5px 12px' }}
          disabled={isRoutineBlocked}
          title={isRoutineBlocked ? 'Procedure recommendations blocked during active emergency alert' : undefined}
          onClick={onCreateProcedure}
        >
          + New Procedure Recommendation
        </button>
      )}
    </div>
    {f.query.isLoading && <p role="status">Loading encounter care references…</p>}
    {(f.query.isError || f.invalid) && <p role="alert">Care references could not be verified for this encounter. Refresh to retry; saved selections are retained.</p>}
    <fieldset className="oph-fieldset" disabled={!f.ready}>
      {config && <label className="doc-field"><span>{config.label} <span className="oph-required">*</span></span><select value={values[config.key] ?? ''} onChange={(event) => onSelect(config.key, event.target.value || null)}>
        <option value="">Select saved record</option>{values[config.key] && !records.some((record) => record.id === values[config.key]) && <option value={values[config.key] ?? ''}>Saved reference {values[config.key]} — unavailable</option>}
        {records.map((record) => <option key={record.id} value={record.id}>{record.id} · {record.status ?? 'Unknown'}</option>)}
      </select>{!f.query.isLoading && f.ready && records.length === 0 && <span>{config.empty}</span>}</label>}
      {actionType === 'INVESTIGATION' && <label className="doc-field"><span>Laboratory / imaging orders <span className="oph-required">*</span></span><select multiple value={values.clinical_order_ids ?? []} onChange={(event) => onOrders(Array.from(event.target.selectedOptions, (option) => option.value))}>
        {(values.clinical_order_ids ?? []).filter((value) => !f.data?.clinical_orders.some((record) => record.id === value)).map((value) => <option key={value} value={value}>Saved reference {value} — unavailable</option>)}
        {f.data?.clinical_orders.map((record) => <option key={record.id} value={record.id}>{record.order_type} · {record.status ?? 'Unknown'} · {record.id}</option>)}
      </select>{!f.query.isLoading && f.ready && !f.data?.clinical_orders.length && <span>No laboratory or imaging order is available for this encounter.</span>}</label>}
    </fieldset>
  </section>;
}
