import type { PatientPortalOverview } from '../../api/patient-portal';
import { Modal } from '../ui/Modal';
import { date, label } from '../../utils/portal-invoice-pdf';

type PortalPatientCardModalProps = {
  open: boolean;
  onClose: () => void;
  patient: PatientPortalOverview['patient'];
  patientPhoneDisplay: string;
};

const fullName = (patient: { first_name: string; middle_name: string | null; last_name: string }) =>
  [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ');

const ageInYears = (dateOfBirth: string) => {
  const birth = new Date(dateOfBirth);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) {
    years -= 1;
  }
  return Math.max(0, years);
};

export function PortalPatientCardModal({
  open,
  onClose,
  patient,
  patientPhoneDisplay,
}: PortalPatientCardModalProps) {
  const patientAge = ageInYears(patient.date_of_birth);
  const initials = [patient.first_name, patient.last_name]
    .filter(Boolean)
    .map((name) => name.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  return (
    <Modal
      icon="ph-identification-card"
      onClose={onClose}
      open={open}
      title="Patient ID Card"
    >
      <div className="portal-patient-card-modal">
        <div className="portal-patient-id-card">
          <div className="portal-id-card-head">
            <div className="portal-id-card-brand">
              <span>H</span>
              <div>
                <strong>HMS Enterprise</strong>
                <small>Hospital Management System</small>
              </div>
            </div>
            <span className="portal-id-card-type">Patient ID</span>
            <div className="portal-id-card-person">
              <div>{initials}</div>
              <span>
                <strong>{fullName(patient)}</strong>
                <small>{patient.patient_number}</small>
              </span>
            </div>
          </div>
          <div className="portal-id-card-body">
            <div className="portal-id-card-grid">
              <div>
                <small>Date of birth</small>
                <strong>{date(patient.date_of_birth)}</strong>
              </div>
              <div>
                <small>Age / gender</small>
                <strong>
                  {patientAge} yrs · {label(patient.gender)}
                </strong>
              </div>
              <div>
                <small>Phone</small>
                <strong>{patientPhoneDisplay}</strong>
              </div>
              <div>
                <small>Status</small>
                <strong className="active">{label(patient.status)}</strong>
              </div>
              <div>
                <small>Registered</small>
                <strong>{date(patient.created_at)}</strong>
              </div>
              <div>
                <small>Blood group</small>
                <strong>{patient.blood_group || 'Not recorded'}</strong>
              </div>
            </div>
            <div className="portal-id-card-barcode">
              <div>
                <span>
                  {[
                    24, 18, 28, 14, 22, 28, 16, 24, 12, 28, 20, 16, 28, 18, 24, 28, 14, 20, 28,
                    16, 24, 12, 28, 18, 24, 16, 28, 22,
                  ].map((height, index) => (
                    <i key={index} style={{ height, width: index % 3 === 0 ? 3 : 1.5 }} />
                  ))}
                </span>
                <small>{patient.patient_number}</small>
              </div>
              <div>
                <small>Valid for</small>
                <strong>All departments</strong>
              </div>
            </div>
          </div>
          <footer>
            <span>This card is non-transferable</span>
            <span>Generated: {date(new Date().toISOString())}</span>
          </footer>
        </div>
        <div className="portal-patient-card-actions">
          <button onClick={onClose} type="button">
            Close
          </button>
          <button className="primary" onClick={() => window.print()} type="button">
            <i className="ph ph-printer" /> Print card
          </button>
        </div>
      </div>
    </Modal>
  );
}
