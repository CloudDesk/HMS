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

  const disposition = useForm<DispositionForm>({
    resolver: zodResolver(dispositionSchema),
    defaultValues: {
      decision: 'ADMIT',
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
        const params = new URLSearchParams({
          branch_id: state.branchId,
          source_type: 'EMERGENCY_ENCOUNTER',
          source_id: selected.id,
          patient_id: selected.patient_id,
          patient_search: selected.patient_number ?? selected.patient_name,
          department_id: selected.department_id,
          doctor_id: selected.assigned_doctor_id,
          reason: value.summary || selected.chief_complaint,
          notes: value.instructions || '',
        });
        toast.success('Emergency admission handoff is ready for Reception.');
        navigate(`/admissions/inpatients?${params.toString()}`);
        return;
      }
      toast.success('Emergency disposition confirmed.');
      navigate(`/emergency?branch_id=${state.branchId}`);
    } catch (error) {
      toast.error(message(error));
    }
  });

  if (!selected) return null;

  return (
    <form onSubmit={confirmDisposition}>
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
              <option value="ADMIT">Admit to Inpatient Unit</option>
              <option value="DISCHARGE">Discharge Home</option>
              <option value="TRANSFER">Transfer to External Facility</option>
              <option value="LEFT">Patient Left against Medical Advice</option>
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
            <label>Clinical Summary & Discharge / Admission Instructions</label>
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
