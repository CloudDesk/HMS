import type { OpdPrescriptionResponse } from '../../api/opd';
import type { PatientResponse, PatientTimelineEventResponse } from '../../api/patients';
import { formatDate, patientFullName } from '../../pages/patient-utils';

const calculateAge = (dob: string) => {
  if (!dob) return '';
  const birthDate = new Date(dob);
  const ageDifMs = Date.now() - birthDate.getTime();
  const ageDate = new Date(ageDifMs);
  const years = Math.abs(ageDate.getUTCFullYear() - 1970);
  return `${years} years`;
};

type PatientOverviewTabProps = {
  patient: PatientResponse;
  prescriptions: OpdPrescriptionResponse[];
  timeline: PatientTimelineEventResponse[];
  formatCurrency: (value: number) => string;
  onViewBilling: () => void;
};

function EmptyRecords({ message }: { message: string }) {
  return <div className="patient-empty-inline">{message}</div>;
}

export function PatientOverviewTab({ patient, prescriptions, timeline, formatCurrency, onViewBilling }: PatientOverviewTabProps) {
  return (
    <div className="profile-6card-grid">
      <article className="profile-overview-card">
        <h3><i className="ph ph-user-circle" /> Personal Information</h3>
        <div className="profile-info-grid">
          <span className="label">Full Name</span>
          <span className="value">{patientFullName(patient)}</span>
          <span className="label">Gender / Age</span>
          <span className="value">{patient.gender}, {calculateAge(patient.date_of_birth)}</span>
          <span className="label">Date of Birth</span>
          <span className="value">{formatDate(patient.date_of_birth)}</span>
          <span className="label">MRN</span>
          <span className="value">{patient.patient_number}</span>
          <span className="label">Address</span>
          <span className="value">{[patient.address.line1, patient.address.city, patient.address.country].filter(Boolean).join(', ') || 'Not recorded'}</span>
          <span className="label">Preferred Language</span>
          <span className="value">English</span>
        </div>
      </article>

      <article className="profile-overview-card">
        <h3><i className="ph ph-phone-call" /> Emergency Contact</h3>
        <div className="profile-info-grid">
          <span className="label">Name</span>
          <span className="value">{patient.emergency_contact.name || 'Not recorded'}</span>
          <span className="label">Relationship</span>
          <span className="value">{patient.emergency_contact.relationship || 'Not recorded'}</span>
          <span className="label">Phone</span>
          <span className="value">{patient.emergency_contact.phone || 'Not recorded'}</span>
        </div>
      </article>

      <article className="profile-overview-card">
        <h3><i className="ph ph-pill" /> Current Prescriptions</h3>
        {prescriptions.flatMap((prescription) => prescription.items).length === 0 ? (
          <EmptyRecords message="No prescriptions recorded for this patient." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {prescriptions.flatMap((prescription) => prescription.items.map((item) => ({ item, pStatus: prescription.status }))).slice(0, 3).map(({ item, pStatus }) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
                <div>
                  <strong>{item.medicine_name}</strong>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.dosage} - {item.frequency} ({item.duration})</div>
                </div>
                <span className={`doc-status ${pStatus === 'SUBMITTED' || pStatus === 'DRAFT' ? 'active' : pStatus === 'DISPENSED' ? 'success' : 'neutral'}`}>{pStatus.charAt(0).toUpperCase() + pStatus.slice(1).toLowerCase()}</span>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="profile-overview-card">
        <h3><i className="ph ph-calendar-blank" /> Recent Visits</h3>
        {timeline.length === 0 ? (
          <EmptyRecords message="No recent visits recorded for this patient." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {timeline.slice(0, 3).map((event) => (
              <div key={event.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem' }}>
                <span>{formatDate(event.occurred_at)} • {event.title}</span>
                <strong style={{ color: '#2563eb' }}>Consultation</strong>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="profile-overview-card">
        <h3><i className="ph ph-receipt" /> Outstanding Bills</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Current balance</span>
            <strong style={{ fontSize: '1.2rem', color: '#0f172a' }}>{formatCurrency(0)}</strong>
          </div>
          <div>
            <button className="doc-btn" onClick={onViewBilling} type="button">View Billing</button>
          </div>
        </div>
      </article>

      <article className="profile-overview-card">
        <h3><i className="ph ph-warning" /> Alerts</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="profile-alert-box">
            <strong>Allergies</strong>
            <div>{patient.notes?.toLowerCase().includes('allergy') ? patient.notes : 'None recorded'}</div>
          </div>
          <div className="profile-alert-box info">
            <strong>Chronic conditions</strong>
            <div>None recorded</div>
          </div>
        </div>
      </article>
    </div>
  );
}
