import type { PatientPortalContext, PatientPortalOverview } from '../../api/patient-portal';
import { date, label } from '../../utils/portal-invoice-pdf';

type PortalProfileTabProps = {
  patient: PatientPortalOverview['patient'];
  portalContext: PatientPortalContext;
  selectedPatientContext: PatientPortalContext['patients'][number] | undefined;
  onViewPatientCard: () => void;
  onNavigateToDocuments: () => void;
  onEditPersonalInformation: () => void;
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

export function PortalProfileTab({
  patient,
  portalContext,
  selectedPatientContext,
  onViewPatientCard,
  onNavigateToDocuments,
  onEditPersonalInformation,
}: PortalProfileTabProps) {
  const patientAge = ageInYears(patient.date_of_birth);
  const initials = [patient.first_name, patient.last_name]
    .filter(Boolean)
    .map((name) => name.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  const patientAddress = patient.address
    ? Object.values(patient.address).filter(Boolean).join(', ')
    : '';

  const emergencyContact = patient.emergency_contact;
  const isMinor = patientAge < 18;
  const isDependentChild =
    selectedPatientContext?.relationship === 'PARENT' ||
    selectedPatientContext?.relationship === 'LEGAL_GUARDIAN';
  const showGuardianDetails =
    portalContext.account.type === 'GUARDIAN' || (isMinor && isDependentChild);
  const guardianProfile = portalContext.account.guardian_profile;
  const guardianAddress = guardianProfile?.address
    ? Object.values(guardianProfile.address).filter(Boolean).join(', ')
    : '';

  const patientEmailDisplay = showGuardianDetails
    ? portalContext.account.email || 'Not recorded'
    : patient.email || 'Not recorded';

  const patientPhoneDisplay = showGuardianDetails
    ? portalContext.account.phone || 'Not recorded'
    : patient.phone || 'Not recorded';

  return (
    <section className="portal-page-section">
      <header>
        <div>
          <p>Patient identity</p>
          <h1>My profile</h1>
          <span>
            Review and maintain personal, contact, address and emergency information.
          </span>
        </div>
        <div className="portal-section-actions">
          <button
            className="portal-book-action secondary"
            onClick={onViewPatientCard}
            type="button"
          >
            <i className="ph ph-identification-card" /> View patient card
          </button>
          <button
            className="portal-book-action secondary"
            onClick={onNavigateToDocuments}
            type="button"
          >
            <i className="ph ph-upload-simple" /> Upload previous record
          </button>
          <button
            className="portal-book-action"
            onClick={onEditPersonalInformation}
            type="button"
          >
            <i className="ph ph-pencil-simple" /> Edit personal information
          </button>
        </div>
      </header>

      <article className="portal-profile-card">
        <div className="portal-profile-head">
          <div className="patient-avatar large">{initials}</div>
          <div>
            <h2>{fullName(patient)}</h2>
            <span>
              {patient.patient_number} · {patientAge} {patientAge === 1 ? 'yr' : 'yrs'} old ·{' '}
              {label(patient.gender)}
            </span>
          </div>
          <span className="portal-status confirmed">Active patient</span>
        </div>
        <div className="portal-profile-grid">
          <div>
            <small>Date of birth</small>
            <strong>{date(patient.date_of_birth)}</strong>
          </div>
          <div>
            <small>Gender</small>
            <strong>{label(patient.gender)}</strong>
          </div>
          <div>
            <small>Blood group</small>
            <strong>{patient.blood_group || 'Not recorded'}</strong>
          </div>
          <div>
            <small>Email</small>
            <strong>{patientEmailDisplay}</strong>
          </div>
          <div>
            <small>Phone</small>
            <strong>{patientPhoneDisplay}</strong>
          </div>
          <div>
            <small>Preferred branch</small>
            <strong>
              {selectedPatientContext?.preferred_branch?.name || 'Not recorded'}
            </strong>
          </div>
          <div>
            <small>Address</small>
            <strong>{patientAddress || 'Not recorded'}</strong>
          </div>
          <div>
            <small>Emergency contact</small>
            <strong>
              {emergencyContact?.name
                ? `${emergencyContact.name}${emergencyContact.relationship ? ` · ${emergencyContact.relationship}` : ''}`
                : 'Not recorded'}
            </strong>
          </div>
          <div>
            <small>Emergency phone</small>
            <strong>{emergencyContact?.phone || 'Not recorded'}</strong>
          </div>
        </div>
        <div className="portal-profile-note">
          <i className="ph ph-info" />
          <span>
            Changes are saved to this patient’s HMS record and recorded in the audit history.
          </span>
        </div>
      </article>

      {showGuardianDetails ? (
        <article className="portal-guardian-card">
          <header>
            <span>
              <i className="ph ph-users-three" />
            </span>
            <div>
              <p>Responsible adult</p>
              <h2>Parent / guardian details</h2>
              <small>These details belong to the adult managing this child’s care.</small>
            </div>
            <span className="portal-relationship-badge">
              {label(
                selectedPatientContext?.relationship || guardianProfile?.relationship || 'PARENT',
              )}
            </span>
          </header>
          <div className="portal-guardian-grid">
            <div>
              <small>Full name</small>
              <strong>{portalContext.account.full_name}</strong>
            </div>
            <div>
              <small>Mobile number</small>
              <strong>{portalContext.account.phone || 'Not recorded'}</strong>
            </div>
            <div>
              <small>Email</small>
              <strong>{portalContext.account.email || 'Not recorded'}</strong>
            </div>
            <div>
              <small>Address</small>
              <strong>{guardianAddress || 'Not recorded'}</strong>
            </div>
            <div>
              <small>Identification</small>
              <strong>
                {guardianProfile?.identification.type || guardianProfile?.identification.number
                  ? [guardianProfile.identification.type, guardianProfile.identification.number]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Not recorded'}
              </strong>
            </div>
            <div>
              <small>Guardian consent</small>
              <strong
                className={
                  guardianProfile?.legal_consent_accepted ? 'guardian-consent-verified' : ''
                }
              >
                {guardianProfile?.legal_consent_accepted ? 'Confirmed' : 'Not recorded'}
              </strong>
            </div>
          </div>
          <footer>
            <i className="ph ph-shield-check" />
            Guardian contact information is stored separately and is not treated as the child’s
            own contact information.
          </footer>
        </article>
      ) : null}
    </section>
  );
}
