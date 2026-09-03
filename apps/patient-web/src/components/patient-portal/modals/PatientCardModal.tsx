import { Modal } from '../../ui/Modal';
import type { PatientPortalOverview } from '../../../api/patient-portal';
import { date, fullName, label } from '../../../utils/formatters';

type PatientCardModalProps = {
  open: boolean;
  onClose: () => void;
  patient: PatientPortalOverview['patient'];
  patientAge: number;
  initials: string;
  patientPhoneDisplay: string;
};

export function PatientCardModal({
  open,
  onClose,
  patient,
  patientAge,
  initials,
  patientPhoneDisplay,
}: PatientCardModalProps) {
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
            <div className="portal-id-card-top">
              <div className="portal-id-card-brand">
                <span>H</span>
                <div>
                  <strong>HMS Enterprise</strong>
                  <small>Hospital Management System</small>
                </div>
              </div>
              <span className="portal-id-card-type">Patient ID</span>
            </div>
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
                    24, 18, 28, 14, 22, 28, 16, 24, 12, 28, 20, 16, 28, 18, 24, 28, 14, 20, 28, 16,
                    24, 12, 28, 18, 24, 16, 28, 22,
                  ].map((height, index) => (
                    <i
                      key={index}
                      style={{ height, width: index % 3 === 0 ? 3 : 1.5 }}
                    />
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
