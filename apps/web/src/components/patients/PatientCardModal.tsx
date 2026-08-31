import type { PatientResponse } from '../../api/patients';
import { patientInitials } from '../../pages/opd-utils';
import { calculatePatientAge, formatDate, patientFullName } from '../../pages/patient-utils';
import { Modal } from '../ui/Modal';

import { executePrintPatientCard } from './PatientPrintHelper';

type PatientCardModalProps = {
  open: boolean;
  patient: PatientResponse;
  onClose: () => void;
};

export function PatientCardModal({ open, patient, onClose }: PatientCardModalProps) {
  return (
    <Modal onClose={onClose} open={open} size="default" title="Patient ID Card">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '0.5rem 0 0.25rem' }}>
        <div style={{ width: '340px', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <div style={{ background: 'linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%)', padding: '20px 20px 24px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <div style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: '13px' }}>H</div>
              <div><div style={{ color: '#fff', fontSize: '13px', fontWeight: 700, lineHeight: 1.2 }}>HMS Enterprise</div><div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '10px' }}>Hospital Management System</div></div>
            </div>
            <span style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: '9px', fontWeight: 700, letterSpacing: '1px', padding: '3px 8px', borderRadius: '20px', textTransform: 'uppercase' }}>Patient ID</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 800, color: '#fff', flexShrink: 0 }}>{patientInitials(patientFullName(patient))}</div>
              <div><div style={{ color: '#fff', fontSize: '18px', fontWeight: 800, lineHeight: 1.2 }}>{patientFullName(patient)}</div><span style={{ marginTop: '4px', display: 'inline-block', background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '12px' }}>MRN-{patient.patient_number}</span></div>
            </div>
          </div>
          <div style={{ padding: '18px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              {([
                ['Date of Birth', formatDate(patient.date_of_birth)],
                ['Age / Gender', `${calculatePatientAge(patient.date_of_birth)} · ${patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()}`],
                ['Phone', patient.phone || 'Not recorded'],
                ['Status', patient.status],
                ['Registered', formatDate(patient.created_at)],
                ['Blood Group', patient.blood_group || 'Not recorded'],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: '9px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{label}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: label === 'Status' ? (patient.status === 'ACTIVE' ? '#16a34a' : '#dc2626') : '#0f172a' }}>{value}</div>
                </div>
              ))}
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '14px 0' }} />
            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '28px' }}>
                  {([24,18,28,14,22,28,16,24,12,28,20,16,28,18,24,28,14,20,28,16,24,12,28,18,24,16,28,22] as number[]).map((height, index) => <div key={index} style={{ width: `${index % 3 === 0 ? 3 : 1.5}px`, height: `${height}px`, background: '#1e293b', borderRadius: '1px' }} />)}
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 500, marginTop: '4px' }}>{patient.patient_number}</div>
              </div>
              <div style={{ textAlign: 'right' }}><div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Valid For</div><div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>All Departments</div></div>
            </div>
          </div>
          <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '10px 20px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '9px', color: '#94a3b8' }}>This card is non-transferable</span>
            <span style={{ fontSize: '9px', color: '#94a3b8' }}>Generated: {new Date().toLocaleDateString()}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="doc-btn" onClick={onClose} type="button">Close</button>
          <button className="doc-btn primary" onClick={() => executePrintPatientCard(patient)} type="button"><i className="ph ph-printer" aria-hidden="true" /> Print Card</button>
        </div>
      </div>
    </Modal>
  );
}



