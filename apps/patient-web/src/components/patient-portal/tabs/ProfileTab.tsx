import type {
  PatientPortalContext,
  PatientPortalOverview,
} from '../../../api/patient-portal';
import { date, fullName, label } from '../../../utils/formatters';
import type { PortalTab } from '../../../hooks/usePatientPortal';

type ProfileTabProps = {
  data: PatientPortalOverview;
  portalContext: PatientPortalContext;
  selectedPatientContext?: PatientPortalContext['patients'][number];
  patientAge: number;
  initials: string;
  setTab: (tab: PortalTab) => void;
  setPatientCardOpen: (open: boolean) => void;
  setEditPersonalInformationOpen: (open: boolean) => void;
};

export function ProfileTab({
  data,
  portalContext,
  selectedPatientContext,
  patientAge,
  initials,
  setTab,
  setPatientCardOpen,
  setEditPersonalInformationOpen,
}: ProfileTabProps) {
  const patient = data.patient;
  const patientAddress = Object.values(patient.address).filter(Boolean).join(', ');
  const emergencyContact = patient.emergency_contact;
  const isMinor = patientAge < 15;
  const guardianProfile = portalContext.account.guardian_profile;
  const guardianAddress = guardianProfile
    ? [
        guardianProfile.address.line1,
        guardianProfile.address.city,
        guardianProfile.address.state,
        guardianProfile.address.country,
        guardianProfile.address.postalCode ?? guardianProfile.address.postal_code,
      ]
        .filter(Boolean)
        .join(', ')
    : '';
  const showGuardianDetails = Boolean(
    isMinor && selectedPatientContext && selectedPatientContext.relationship !== 'SELF',
  );
  const patientEmailDisplay =
    showGuardianDetails && patient.email === portalContext.account.email
      ? 'Managed through guardian'
      : patient.email || 'Not recorded';
  const patientPhoneDisplay =
    showGuardianDetails && patient.phone === portalContext.account.phone
      ? 'Managed through guardian'
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
            onClick={() => setPatientCardOpen(true)}
            type="button"
          >
            <i className="ph ph-identification-card" /> View patient card
          </button>
          <button
            className="portal-book-action secondary"
            onClick={() => setTab('documents')}
            type="button"
          >
            <i className="ph ph-upload-simple" /> Upload previous record
          </button>
          <button
            className="portal-book-action"
            onClick={() => setEditPersonalInformationOpen(true)}
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
                selectedPatientContext?.relationship ||
                  guardianProfile?.relationship ||
                  'PARENT',
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
                  ? [
                      guardianProfile.identification.type,
                      guardianProfile.identification.number,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Not recorded'}
              </strong>
            </div>
            <div>
              <small>Guardian consent</small>
              <strong
                className={
                  guardianProfile?.legal_consent_accepted
                    ? 'guardian-consent-verified'
                    : ''
                }
              >
                {guardianProfile?.legal_consent_accepted ? 'Confirmed' : 'Not recorded'}
              </strong>
            </div>
          </div>

          <footer>
            <i className="ph ph-shield-check" />
            Guardian contact information is stored separately and is not treated as the child’s own contact information.
          </footer>
        </article>
      ) : null}
    </section>
  );
}
