import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { EmergencyWorkspaceProps } from './types';
import { message } from './utils';

export type EmergencyReferralSectionProps = {
  state: EmergencyWorkspaceProps['state'];
  mutations: EmergencyWorkspaceProps['mutations'];
};

export function EmergencyReferralSection({ state, mutations }: EmergencyReferralSectionProps) {
  const selected = state.selected || state.encounters[0] || null;

  const [refDeptId, setRefDeptId] = useState('');
  const [refDoctorId, setRefDoctorId] = useState('');
  const [refPriority, setRefPriority] = useState('EMERGENCY');
  const [refReason, setRefReason] = useState('Specialist Emergency Consultation');
  const [refNotes, setRefNotes] = useState('');

  useEffect(() => {
    if (!selected?.referral) return;
    setRefDeptId(selected.referral.target_department_id);
    setRefDoctorId(selected.referral.target_doctor_id ?? '');
    setRefPriority(selected.referral.priority);
    setRefReason(selected.referral.reason);
    setRefNotes(selected.referral.clinical_notes);
  }, [selected?.referral]);

  if (!selected) return null;

  const handleAddReferral = async (event: FormEvent) => {
    event.preventDefault();
    if (!refDeptId) {
      toast.error('Select a department.');
      return;
    }
    try {
      await mutations.referral.mutateAsync({
        id: selected.id,
        body: {
          target_department_id: refDeptId,
          target_doctor_id: refDoctorId || undefined,
          priority: refPriority as 'EMERGENCY' | 'URGENT' | 'ROUTINE',
          reason: refReason,
          clinical_notes: refNotes.trim() || undefined,
        },
      });
      toast.success('Clinical referral dispatched.');
    } catch (error) {
      toast.error(message(error));
    }
  };

  return (
    <form
      onSubmit={handleAddReferral}
      className="emergency-form-section"
      style={{
        background: '#fff',
        borderRadius: '10px',
        padding: '18px',
        border: '1px solid #e2e8f0',
      }}
    >
      <div className="emergency-section-active-header" style={{ margin: '-6px -6px 14px -6px' }}>
        <div className="emergency-active-badge">
          <i className="ph ph-share-network" /> Primary Physician Duty – Clinical Specialist Referral
        </div>
        <p className="emergency-active-desc">
          Coordinate emergency specialist consults, ICU/HDU step-up, and inter-departmental referrals.
        </p>
      </div>

      <div className="emergency-form-head" style={{ marginBottom: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
          Emergency Clinical Referral &amp; Coordination
        </h3>
        <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
          Coordinate emergency specialist consults and department referrals
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
        <div className="adm-field">
          <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Referring To Department *</label>
          <select
            value={refDeptId}
            onChange={(e) => {
              setRefDeptId(e.target.value);
              setRefDoctorId('');
            }}
            required
          >
            <option value="">Select Department</option>
            {state.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="adm-field">
          <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>
            Target Specialist / Doctor (Optional)
          </label>
          <select value={refDoctorId} onChange={(e) => setRefDoctorId(e.target.value)}>
            <option value="">Select Doctor</option>
            {state.doctors
              .filter((doc) => !refDeptId || doc.department_id === refDeptId)
              .map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.display_name}
                </option>
              ))}
          </select>
        </div>

        <div className="adm-field">
          <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Referral Urgency</label>
          <select value={refPriority} onChange={(e) => setRefPriority(e.target.value)}>
            <option value="EMERGENCY">Immediate Emergency Transfer / Bedside Review</option>
            <option value="URGENT">Urgent Same-Day Consult</option>
            <option value="ROUTINE">Routine Consult</option>
          </select>
        </div>

        <div className="adm-field">
          <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Reason for Referral</label>
          <select value={refReason} onChange={(e) => setRefReason(e.target.value)}>
            <option value="Specialist Emergency Consultation">Specialist Emergency Consultation</option>
            <option value="Inpatient Admission / Bed Hold">Inpatient Admission / Bed Hold</option>
            <option value="Emergency Surgical Clearance">Emergency Surgical Clearance</option>
            <option value="ICU / HDU Step-Up">ICU / HDU Step-Up</option>
          </select>
        </div>
      </div>

      <div className="adm-field" style={{ marginTop: '0.75rem' }}>
        <label style={{ fontSize: '0.76rem', fontWeight: 600 }}>Clinical Summary &amp; Handover Notes</label>
        <textarea
          placeholder="Patient summary, immediate emergency stabilization performed, pending investigations..."
          value={refNotes}
          onChange={(e) => setRefNotes(e.target.value)}
          rows={3}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
        <button
          className="btn-emergency-primary"
          disabled={state.pending.referral || Boolean(selected.referral)}
          type="submit"
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '6px',
            border: 'none',
            background: '#dc2626',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <i className="ph ph-paper-plane-tilt" />{' '}
          {selected.referral
            ? 'Referral Submitted'
            : state.pending.referral
              ? 'Submitting...'
              : 'Dispatch Clinical Referral'}
        </button>
      </div>
    </form>
  );
}
