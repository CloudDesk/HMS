import type { PatientResponse } from '../../api/patients';
import { patientInitials } from '../../pages/opd-utils';
import { calculateAge, formatDate, patientFullName } from '../../pages/patient-utils';

type PatientProfileHeaderProps = {
  patient: PatientResponse;
  onEdit: () => void;
  onBookAppointment: () => void;
  onViewCard: () => void;
};

export function PatientProfileHeader({ patient, onEdit, onBookAppointment, onViewCard }: PatientProfileHeaderProps) {
  return (
    <section className="profile-hero-card">
      <div className="profile-hero-left">
        <div className="profile-hero-avatar">
          <span>{patientInitials(patientFullName(patient))}</span>
        </div>
        <div className="profile-hero-info">
          <div className="profile-hero-title">
            <h2>{patientFullName(patient)}</h2>
            <span className="profile-mrn-badge">MRN-{patient.patient_number}</span>
            <span className={`doc-status ${patient.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
              {patient.status}
            </span>
          </div>
          <div className="profile-hero-meta">
            <span><i className="ph ph-user" /> {patient.gender}</span>
            <span className="divider">•</span>
            <span><i className="ph ph-cake" /> {calculateAge(patient.date_of_birth)} ({formatDate(patient.date_of_birth)})</span>
            <span className="divider">•</span>
            <span><i className="ph ph-phone" /> {patient.phone || 'Phone not recorded'}</span>
            <span className="divider">•</span>
            <span><i className="ph ph-envelope" /> {patient.email || 'Email not recorded'}</span>
            <span className="divider">•</span>
            <span><i className="ph ph-map-pin" /> {[patient.address.line1, patient.address.city, patient.address.country].filter(Boolean).join(', ') || 'Address not recorded'}</span>
            <span className="divider">•</span>
            <span><i className="ph ph-drop" /> Blood: {patient.blood_group || 'Not recorded'}</span>
            <span className="divider">•</span>
            <span><i className="ph ph-clock" /> Registered {formatDate(patient.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="profile-hero-actions">
        <button className="doc-btn" onClick={onEdit} type="button">
          <i className="ph ph-pencil-simple" aria-hidden="true" /> Edit Patient
        </button>
        <button className="doc-btn primary" onClick={onBookAppointment} type="button">
          <i className="ph ph-calendar-plus" aria-hidden="true" /> Book Appointment
        </button>
        <button className="doc-btn" onClick={onViewCard} type="button">
          <i className="ph ph-identification-card" aria-hidden="true" /> View Card
        </button>
      </div>
    </section>
  );
}
