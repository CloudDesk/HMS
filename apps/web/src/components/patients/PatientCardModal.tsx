import type { PatientResponse } from '../../api/patients';
import { patientInitials } from '../../pages/opd-utils';
import { formatDate, patientFullName } from '../../pages/patient-utils';
import { Modal } from '../ui/Modal';

const printPatientCard = (patient: PatientResponse) => {
  const fullName = patientFullName(patient);
  const initials = patientInitials(fullName);
  const age = new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear();
  const dob = formatDate(patient.date_of_birth);
  const registered = formatDate(patient.created_at);
  const statusColor = patient.status === 'ACTIVE' ? '#16a34a' : patient.status === 'DECEASED' ? '#6b7280' : '#dc2626';
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Patient Card — ${fullName}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{width:340px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.13);overflow:hidden}
.card-header{background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:20px 20px 28px;position:relative}
.hospital-row{display:flex;align-items:center;gap:8px;margin-bottom:18px}
.hospital-logo{width:32px;height:32px;background:rgba(255,255,255,.2);border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:13px}
.hospital-name{color:#fff;font-size:13px;font-weight:700;line-height:1.2}
.hospital-sub{color:rgba(255,255,255,.65);font-size:10px}
.card-type-badge{position:absolute;top:16px;right:16px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:#fff;font-size:9px;font-weight:700;letter-spacing:1px;padding:3px 8px;border-radius:20px;text-transform:uppercase}
.avatar-row{display:flex;align-items:center;gap:14px}
.avatar{width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.2);border:3px solid rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;flex-shrink:0}
.avatar-info .name{color:#fff;font-size:18px;font-weight:800;line-height:1.2}
.avatar-info .mrn{margin-top:4px;display:inline-block;background:rgba(255,255,255,.18);color:#fff;font-size:11px;font-weight:600;padding:2px 10px;border-radius:12px}
.status-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px}
.card-body{padding:18px 20px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
.info-item .label{font-size:9px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
.info-item .value{font-size:13px;font-weight:600;color:#0f172a}
.divider{border:none;border-top:1px solid #e2e8f0;margin:14px 0}
.barcode-row{background:#f8fafc;border-radius:8px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between}
.barcode-lines{display:flex;align-items:flex-end;gap:2px;height:28px}
.bar{background:#1e293b;border-radius:1px}
.barcode-label{font-size:10px;color:#64748b;font-weight:500}
.card-footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:10px 20px;display:flex;justify-content:space-between;align-items:center}
.footer-text{font-size:9px;color:#94a3b8}
.blood-badge{background:#fef2f2;color:#dc2626;font-weight:800;font-size:13px;padding:2px 10px;border-radius:8px;border:1px solid #fecaca}
@media print{body{background:#fff}.card{box-shadow:none;border:1px solid #e2e8f0}.no-print{display:none!important}}
.print-btn{display:block;width:100%;margin-top:20px;padding:12px;background:#2563eb;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}
</style></head><body><div>
<div class="card">
<div class="card-header">
<div class="hospital-row"><div class="hospital-logo">H</div><div><div class="hospital-name">HMS Enterprise</div><div class="hospital-sub">Hospital Management System</div></div></div>
<span class="card-type-badge">Patient ID</span>
<div class="avatar-row"><div class="avatar">${initials}</div><div class="avatar-info"><div class="name">${fullName}</div><span class="mrn">MRN-${patient.patient_number}</span></div></div>
</div>
<div class="card-body">
<div class="info-grid">
<div class="info-item"><div class="label">Date of Birth</div><div class="value">${dob}</div></div>
<div class="info-item"><div class="label">Age / Gender</div><div class="value">${age} yrs · ${patient.gender.charAt(0)+patient.gender.slice(1).toLowerCase()}</div></div>
<div class="info-item"><div class="label">Phone</div><div class="value">${patient.phone||'Not recorded'}</div></div>
<div class="info-item"><div class="label">Status</div><div class="value"><span class="status-dot" style="background:${statusColor}"></span>${patient.status}</div></div>
<div class="info-item"><div class="label">Registered</div><div class="value">${registered}</div></div>
<div class="info-item"><div class="label">Blood Group</div><div class="value">${patient.blood_group?`<span class="blood-badge">${patient.blood_group}</span>`:'Not recorded'}</div></div>
</div>
<hr class="divider"/>
<div class="barcode-row"><div><div class="barcode-lines">${Array.from({length:28},(_,i)=>{const h=[24,18,28,14,22,28,16,24,12,28,20,16,28,18,24,28,14,20,28,16,24,12,28,18,24,16,28,22][i];const w=i%3===0?3:1.5;return`<div class="bar" style="width:${w}px;height:${h}px"></div>`;}).join('')}</div><div class="barcode-label" style="margin-top:4px">${patient.patient_number}</div></div><div style="text-align:right"><div style="font-size:10px;color:#64748b;font-weight:600">Valid For</div><div style="font-size:12px;font-weight:700;color:#0f172a">All Departments</div></div></div>
</div>
<div class="card-footer"><span class="footer-text">This card is non-transferable</span><span class="footer-text">Printed: ${new Date().toLocaleDateString()}</span></div>
</div>
<button class="print-btn no-print" onclick="window.print()">🖨️ Print Card</button>
</div><script>window.onload=()=>window.print();</script></body></html>`;
  const printWindow = window.open('', '_blank', 'width=480,height=700,scrollbars=no,toolbar=no,menubar=no');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
};

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
                ['Age / Gender', `${new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} yrs · ${patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()}`],
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
          <button className="doc-btn primary" onClick={() => printPatientCard(patient)} type="button"><i className="ph ph-printer" aria-hidden="true" /> Print Card</button>
        </div>
      </div>
    </Modal>
  );
}
