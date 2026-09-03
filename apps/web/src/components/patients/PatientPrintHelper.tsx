import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { PatientResponse } from '../../api/patients';
import { useHospitalSettings } from '../../hooks/settings/useSettings';
import { patientInitials } from '../../pages/opd-utils';
import { formatDate, patientFullName } from '../../pages/patient-utils';

export type PatientCardHospitalSettings = {
  hospitalName?: string;
  phone?: string;
  address?: string;
  logoUrl?: string | null;
};

export function PatientCardPrintView({
  patient,
  targetWindow,
  hospitalSettings,
}: {
  patient: PatientResponse;
  targetWindow: Window;
  hospitalSettings?: PatientCardHospitalSettings;
}) {
  const fullName = patientFullName(patient);
  const initials = patientInitials(fullName);
  const age = new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear();
  const dob = formatDate(patient.date_of_birth);
  const registered = formatDate(patient.created_at);
  const statusColor = patient.status === 'ACTIVE' ? '#16a34a' : patient.status === 'DECEASED' ? '#6b7280' : '#dc2626';

  const queriedSettings = useHospitalSettings();
  const settings = hospitalSettings ?? queriedSettings;

  const hospitalName = settings.hospitalName || 'Hospital Management System';
  const phone = settings.phone;
  const address = settings.address;
  const logoUrl = settings.logoUrl;
  const hospitalSubText = [address, phone].filter(Boolean).join(' · ') || 'Hospital Management System';

  const heights = [24, 18, 28, 14, 22, 28, 16, 24, 12, 28, 20, 16, 28, 18, 24, 28, 14, 20, 28, 16, 24, 12, 28, 18, 24, 16, 28, 22];

  useEffect(() => {
    const timer = setTimeout(() => {
      targetWindow.print();
    }, 300);
    return () => clearTimeout(timer);
  }, [targetWindow]);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div className="hospital-row">
            {logoUrl ? (
              <img alt={hospitalName} src={logoUrl} style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'contain', background: 'rgba(255,255,255,0.2)' }} />
            ) : (
              <div className="hospital-logo">{hospitalName.charAt(0) || 'H'}</div>
            )}
            <div>
              <div className="hospital-name">{hospitalName}</div>
              <div className="hospital-sub">{hospitalSubText}</div>
            </div>
          </div>
          <span className="card-type-badge">Patient ID</span>
          <div className="avatar-row">
            <div className="avatar">{initials}</div>
            <div className="avatar-info">
              <div className="name">{fullName}</div>
              <span className="mrn">MRN-{patient.patient_number}</span>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="info-grid">
            <div className="info-item">
              <div className="label">Date of Birth</div>
              <div className="value">{dob}</div>
            </div>
            <div className="info-item">
              <div className="label">Age / Gender</div>
              <div className="value">{age} yrs · {patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()}</div>
            </div>
            <div className="info-item">
              <div className="label">Phone</div>
              <div className="value">{patient.phone || 'Not recorded'}</div>
            </div>
            <div className="info-item">
              <div className="label">Status</div>
              <div className="value">
                <span className="status-dot" style={{ background: statusColor }}></span>
                {patient.status}
              </div>
            </div>
            <div className="info-item">
              <div className="label">Registered</div>
              <div className="value">{registered}</div>
            </div>
            <div className="info-item">
              <div className="label">Blood Group</div>
              <div className="value">
                {patient.blood_group ? (
                  <span className="blood-badge">{patient.blood_group}</span>
                ) : (
                  'Not recorded'
                )}
              </div>
            </div>
          </div>
          <hr className="divider" />
          <div className="barcode-row">
            <div>
              <div className="barcode-lines">
                {heights.map((h, i) => {
                  const w = i % 3 === 0 ? 3 : 1.5;
                  return <div key={i} className="bar" style={{ width: `${w}px`, height: `${h}px` }}></div>;
                })}
              </div>
              <div className="barcode-label" style={{ marginTop: '4px' }}>{patient.patient_number}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Valid For</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>All Departments</div>
            </div>
          </div>
        </div>
        <div className="card-footer">
          <span className="footer-text">This card is non-transferable</span>
          <span className="footer-text">Printed: {new Date().toLocaleDateString()}</span>
        </div>
      </div>
      <button className="print-btn no-print" onClick={() => targetWindow.print()}>Print Card</button>
    </div>
  );
}

export function executePrintPatientCard(patient: PatientResponse, hospitalSettings?: PatientCardHospitalSettings) {
  const printWindow = window.open('', '_blank', 'width=480,height=700,scrollbars=no,toolbar=no,menubar=no');
  if (!printWindow) return;

  const doc = printWindow.document;
  doc.title = `Patient Card - ${patientFullName(patient)}`;
  
  const style = doc.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { width: 340px; background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,.13); overflow: hidden; }
    .card-header { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 20px 20px 28px; position: relative; }
    .hospital-row { display: flex; align-items: center; gap: 8px; margin-bottom: 18px; }
    .hospital-logo { width: 32px; height: 32px; background: rgba(255,255,255,.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #fff; font-size: 13px; }
    .hospital-name { color: #fff; font-size: 13px; font-weight: 700; line-height: 1.2; }
    .hospital-sub { color: rgba(255,255,255,.65); font-size: 10px; }
    .card-type-badge { position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.3); color: #fff; font-size: 9px; font-weight: 700; letter-spacing: 1px; padding: 3px 8px; border-radius: 20px; text-transform: uppercase; }
    .avatar-row { display: flex; align-items: center; gap: 14px; }
    .avatar { width: 64px; height: 64px; border-radius: 50%; background: rgba(255,255,255,.2); border: 3px solid rgba(255,255,255,.5); display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; color: #fff; flex-shrink: 0; }
    .avatar-info .name { color: #fff; font-size: 18px; font-weight: 800; line-height: 1.2; }
    .avatar-info .mrn { margin-top: 4px; display: inline-block; background: rgba(255,255,255,.18); color: #fff; font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 12px; }
    .status-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 4px; }
    .card-body { padding: 18px 20px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
    .info-item .label { font-size: 9px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 2px; }
    .info-item .value { font-size: 13px; font-weight: 600; color: #0f172a; word-break: break-word; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 14px 0; }
    .barcode-row { background: #f8fafc; border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; }
    .barcode-lines { display: flex; align-items: flex-end; gap: 2px; height: 28px; }
    .bar { background: #1e293b; border-radius: 1px; }
    .barcode-label { font-size: 10px; color: #64748b; font-weight: 500; }
    .card-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; }
    .footer-text { font-size: 9px; color: #94a3b8; }
    .blood-badge { background: #fef2f2; color: #dc2626; font-weight: 800; font-size: 13px; padding: 2px 10px; border-radius: 8px; border: 1px solid #fecaca; }
    @media print { body { background: #fff; } .card { box-shadow: none; border: 1px solid #e2e8f0; } .no-print { display: none !important; } }
    .print-btn { display: block; width: 100%; margin-top: 20px; padding: 12px; background: #2563eb; color: #fff; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; }
  `;
  
  doc.head.appendChild(style);

  const rootDiv = doc.createElement('div');
  doc.body.appendChild(rootDiv);

  const root = createRoot(rootDiv);
  root.render(<PatientCardPrintView patient={patient} targetWindow={printWindow} hospitalSettings={hospitalSettings} />);
}
