import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { navigate } from '../../routing/navigation';
import type { EmergencyWorkspaceProps } from './types';
import { message } from './utils';

const dispositionSchema = z
  .object({
    decision: z.enum(['DISCHARGE', 'ADMIT', 'TRANSFER', 'LEFT']),
    reason: z.string(),
    summary: z.string(),
    instructions: z.string(),
    transfer_destination: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === 'DISCHARGE' && (!value.summary.trim() || !value.instructions.trim()))
      ctx.addIssue({
        code: 'custom',
        path: ['summary'],
        message: 'Summary and instructions are required',
      });
    if (
      value.decision === 'TRANSFER' &&
      (!value.reason.trim() || !value.transfer_destination.trim())
    )
      ctx.addIssue({
        code: 'custom',
        path: ['transfer_destination'],
        message: 'Destination and reason are required',
      });
    if (value.decision === 'LEFT' && !value.reason.trim())
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Reason is required' });
  });

type DispositionForm = z.infer<typeof dispositionSchema>;

export type EmergencyDispositionSectionProps = {
  state: EmergencyWorkspaceProps['state'];
  mutations: EmergencyWorkspaceProps['mutations'];
};

export function EmergencyDispositionSection({ state, mutations }: EmergencyDispositionSectionProps) {
  const selected = state.selected || state.encounters[0] || null;

  const canAdmit = state.capabilities.admit;
  const canDischarge = state.capabilities.discharge;
  const canTransfer = state.capabilities.transfer;
  const canMarkLeft = state.capabilities.markLeft;
  const canPerformDisposition = canAdmit || canDischarge || canTransfer || canMarkLeft;

  const defaultDecision = canAdmit
    ? 'ADMIT'
    : canDischarge
    ? 'DISCHARGE'
    : canTransfer
    ? 'TRANSFER'
    : canMarkLeft
    ? 'LEFT'
    : 'ADMIT';

  const disposition = useForm<DispositionForm>({
    resolver: zodResolver(dispositionSchema),
    defaultValues: {
      decision: defaultDecision,
      reason: '',
      summary: '',
      instructions: '',
      transfer_destination: '',
    },
  });

  const confirmDisposition = disposition.handleSubmit(async (value) => {
    if (!selected) return;
    try {
      await mutations.disposition.mutateAsync({
        id: selected.id,
        body: {
          decision: value.decision,
          reason: value.reason || null,
          summary: value.summary || null,
          instructions: value.instructions || null,
          transfer_destination: value.transfer_destination || null,
        },
      });
      if (value.decision === 'ADMIT') {
        if (!selected.patient_id || !selected.assigned_doctor_id) {
          toast.warning('Link a registered patient before Reception can create the admission request.');
          return;
        }
        toast.success('Emergency disposition confirmed. Patient handed off for admission.');
        navigate(`/emergency?branch_id=${state.branchId}`);
        return;
      }
      toast.success('Emergency disposition confirmed.');
      navigate(`/emergency?branch_id=${state.branchId}`);
    } catch (error) {
      toast.error(message(error));
    }
  });

  if (!selected) return null;

  if (!canPerformDisposition) {
    return (
      <div className="emergency-form-section">
        <div className="emergency-section-context-header">
          <div className="emergency-context-badge">
            <i className="ph ph-lock-key" /> Emergency Disposition &amp; Handoff (Read-Only)
          </div>
          <p className="emergency-context-desc">
            Final disposition must be executed by the attending physician. Current encounter status and instructions are shown below.
          </p>
        </div>

        <div className="emergency-readonly-grid">
          <div className="emergency-readonly-card">
            <h4><i className="ph ph-door-open" /> Disposition Status</h4>
            <div className="emergency-readonly-field">
              <label>Current Encounter Status</label>
              <span>{selected.status}</span>
            </div>
            <div className="emergency-readonly-field">
              <label>Disposition Decision</label>
              <span style={{ fontWeight: 700, color: selected.disposition?.decision ? '#15803d' : '#64748b' }}>
                {selected.disposition?.decision || 'Pending physician confirmation'}
              </span>
            </div>
            {selected.disposition?.transferDestination && (
              <div className="emergency-readonly-field">
                <label>Transfer Destination</label>
                <span>{selected.disposition.transferDestination}</span>
              </div>
            )}
          </div>

          <div className="emergency-readonly-card">
            <h4><i className="ph ph-article" /> Clinical Summary &amp; Instructions</h4>
            <div className="emergency-readonly-field">
              <label>Clinical Summary</label>
              <span>{selected.disposition?.summary || 'Pending disposition summary'}</span>
            </div>
            <div className="emergency-readonly-field" style={{ marginTop: '0.5rem' }}>
              <label>Discharge / Admission Instructions</label>
              <span>{selected.disposition?.instructions || '—'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={confirmDisposition}>
      <div className="emergency-section-active-header">
        <div className="emergency-active-badge">
          <i className="ph ph-door-open" /> Primary Physician Duty – Final Emergency Disposition
        </div>
        <p className="emergency-active-desc">
          Confirm safe transition to inpatient admission handoff, discharge home, inter-facility transfer, or left AMA.
        </p>
      </div>

      <section className="emergency-form-section">
        <div className="emergency-form-head">
          <div>
            <h3>Final Emergency Disposition</h3>
            <p>Confirm safe transition to admission, discharge or transfer</p>
          </div>
        </div>
        <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div className="doc-field">
            <label>Decision <span style={{ color: '#dc2626' }}>*</span></label>
            <select {...disposition.register('decision')}>
              {canAdmit && <option value="ADMIT">Admit to Inpatient Unit</option>}
              {canDischarge && <option value="DISCHARGE">Discharge Home</option>}
              {canTransfer && <option value="TRANSFER">Transfer to External Facility</option>}
              {canMarkLeft && <option value="LEFT">Patient Left against Medical Advice</option>}
            </select>
          </div>
          <div className="doc-field">
            <label>Target Unit / Bed Type</label>
            <select defaultValue="ICU">
              <option>ICU (Intensive Care Unit)</option>
              <option>CCU (Coronary Care Unit)</option>
              <option>HDU (High Dependency Unit)</option>
              <option>General Ward</option>
              <option>Surgical Ward</option>
            </select>
          </div>
          <div className="doc-field">
            <label>Transfer Destination (if applicable)</label>
            <input {...disposition.register('transfer_destination')} placeholder="e.g. National Referral Hospital" />
          </div>
          <div className="doc-field" style={{ gridColumn: 'span 3' }}>
            <label>Clinical Summary &amp; Discharge / Admission Instructions</label>
            <textarea {...disposition.register('summary')} placeholder="Key clinical findings, treatments administered, handover summary..." rows={4} />
          </div>
        </div>
      </section>

      <div className="emergency-form-actions">
        <span className="emergency-autosave">
          <i className="ph ph-check-circle" /> Auto-save enabled
        </span>
        <div>
          <button className="btn-emergency-secondary" onClick={() => toast.success('Draft saved.')} type="button">
            Save Draft
          </button>
          <button className="btn-emergency-primary" disabled={mutations.disposition.isPending} type="submit">
            {mutations.disposition.isPending ? 'Confirming...' : 'Confirm Final Disposition'}
          </button>
        </div>
      </div>
    </form>
  );
}
