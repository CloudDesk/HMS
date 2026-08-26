import { useState } from 'react';
import { toast } from 'sonner';
import type { EmergencyTriageLevel } from '../../api/emergency';
import { Modal } from '../ui/Modal';
import type { EmergencyWorkspaceProps } from './types';
import { message, triageLabel } from './utils';

const levels: EmergencyTriageLevel[] = [
  'LEVEL_1_CRITICAL',
  'LEVEL_2_HIGH',
  'LEVEL_3_MEDIUM',
  'LEVEL_4_LOW',
  'LEVEL_5_NON_URGENT',
];

export type EmergencyModalsProps = {
  state: EmergencyWorkspaceProps['state'];
  actions: EmergencyWorkspaceProps['actions'];
  mutations: EmergencyWorkspaceProps['mutations'];
  linkPatientOpen: boolean;
  setLinkPatientOpen: (open: boolean) => void;
  priorityOpen: boolean;
  setPriorityOpen: (open: boolean) => void;
};

export function EmergencyModals({
  state,
  actions,
  mutations,
  linkPatientOpen,
  setLinkPatientOpen,
  priorityOpen,
  setPriorityOpen,
}: EmergencyModalsProps) {
  const selected = state.selected || state.encounters[0] || null;

  const [linkPatientId, setLinkPatientId] = useState('');
  const [linkReason, setLinkReason] = useState('');
  const [priorityLevel, setPriorityLevel] = useState<EmergencyTriageLevel>('LEVEL_3_MEDIUM');
  const [priorityReason, setPriorityReason] = useState('');

  const linkPatient = async () => {
    if (!selected || !linkPatientId) {
      toast.error('Select a patient record.');
      return;
    }
    try {
      await mutations.linkPatient.mutateAsync({
        id: selected.id,
        patientId: linkPatientId,
        reason: linkReason || undefined,
      });
      toast.success('Emergency encounter linked to the patient record.');
      setLinkPatientOpen(false);
      setLinkPatientId('');
      setLinkReason('');
    } catch (error) {
      toast.error(message(error));
    }
  };

  const overridePriority = async () => {
    if (!selected || priorityReason.trim().length < 3) {
      toast.error('Enter a reason with at least 3 characters.');
      return;
    }
    try {
      await mutations.overridePriority.mutateAsync({
        id: selected.id,
        level: priorityLevel,
        reason: priorityReason,
      });
      toast.success('Emergency priority updated.');
      setPriorityOpen(false);
      setPriorityReason('');
    } catch (error) {
      toast.error(message(error));
    }
  };

  return (
    <>
      <Modal
        onClose={() => setLinkPatientOpen(false)}
        open={linkPatientOpen}
        title="Link to Patient Master Record"
      >
        <div className="form-grid">
          <label className="form-grid__full">
            Search Patient
            <input
              onChange={(e) => actions.setPatientSearch(e.target.value)}
              placeholder="Search by name, MRN or phone"
              value={state.patientSearch}
            />
          </label>
          <label className="form-grid__full">
            Select Patient Record <span style={{ color: '#dc2626' }}>*</span>
            <select onChange={(e) => setLinkPatientId(e.target.value)} value={linkPatientId}>
              <option value="">Select registered patient</option>
              {state.patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.patient_number} - {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-grid__full">
            Reason for Linking
            <input
              onChange={(e) => setLinkReason(e.target.value)}
              placeholder="Identity confirmed via national ID..."
              value={linkReason}
            />
          </label>
          <div className="form-grid__full page-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button className="btn-emergency-secondary" onClick={() => setLinkPatientOpen(false)} type="button">
              Cancel
            </button>
            <button className="btn-emergency-primary" disabled={mutations.linkPatient.isPending} onClick={() => void linkPatient()} type="button">
              {mutations.linkPatient.isPending ? 'Linking...' : 'Link Patient'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        onClose={() => setPriorityOpen(false)}
        open={priorityOpen}
        title="Override Emergency Priority"
      >
        <div className="form-grid">
          <label className="form-grid__full">
            New Priority Level
            <select
              onChange={(e) => setPriorityLevel(e.target.value as EmergencyTriageLevel)}
              value={priorityLevel}
            >
              {levels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {triageLabel(lvl)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-grid__full">
            Clinical Reason for Override <span style={{ color: '#dc2626' }}>*</span>
            <textarea
              onChange={(e) => setPriorityReason(e.target.value)}
              placeholder="Sudden deterioration, altered vitals..."
              rows={3}
              value={priorityReason}
            />
          </label>
          <div className="form-grid__full page-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button className="btn-emergency-secondary" onClick={() => setPriorityOpen(false)} type="button">
              Cancel
            </button>
            <button className="btn-emergency-primary" disabled={mutations.overridePriority.isPending} onClick={() => void overridePriority()} type="button">
              {mutations.overridePriority.isPending ? 'Updating...' : 'Update Priority'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
