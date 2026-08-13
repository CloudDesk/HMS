import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-error';
import {
  patientsApi,
  type ApiPatientGender,
  type PatientResponse,
  type SavePatientPayload,
} from '../api/patients';
import { Toast } from '../components/ui/Toast';
import { navigate } from '../routing/navigation';
import { getPatientErrorMessage, patientFullName } from './patient-utils';

type PatientFormState = {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: ApiPatientGender;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  bloodGroup: string;
  notes: string;
  consent: boolean;
};

type FieldErrors = {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  consent?: string;
};

type DuplicateDetails = {
  duplicates?: PatientResponse[];
};

const emptyPatientForm: PatientFormState = {
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  gender: 'UNKNOWN',
  phone: '',
  email: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  emergencyName: '',
  emergencyRelationship: '',
  emergencyPhone: '',
  bloodGroup: '',
  notes: '',
  consent: false,
};

const nullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toPatientPayload = (form: PatientFormState): SavePatientPayload => ({
  first_name: form.firstName.trim(),
  middle_name: nullable(form.middleName),
  last_name: form.lastName.trim(),
  date_of_birth: form.dateOfBirth,
  gender: form.gender,
  phone: nullable(form.phone),
  email: nullable(form.email),
  blood_group: nullable(form.bloodGroup),
  address: {
    line1: nullable(form.addressLine1),
    line2: nullable(form.addressLine2),
    city: nullable(form.city),
    state: nullable(form.state),
    country: nullable(form.country),
    postal_code: nullable(form.postalCode),
  },
  emergency_contact: {
    name: nullable(form.emergencyName),
    relationship: nullable(form.emergencyRelationship),
    phone: nullable(form.emergencyPhone),
  },
  notes: nullable(form.notes),
});

const hasDuplicateDetails = (details: unknown): details is DuplicateDetails =>
  typeof details === 'object' && details !== null && 'duplicates' in details;

const getDuplicatePatients = (error: unknown) => {
  if (!(error instanceof ApiError) || error.status !== 409 || !hasDuplicateDetails(error.details)) {
    return [];
  }

  return Array.isArray(error.details.duplicates) ? error.details.duplicates : [];
};

type RegistrationSectionProps = {
  children: React.ReactNode;
  description: string;
  number: number;
  title: string;
};

function RegistrationSection({ children, description, number, title }: RegistrationSectionProps) {
  return (
    <section className="patient-form-section">
      <div className="patient-form-section-header">
        <i aria-hidden="true">{number}</i>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      <div className="doc-form-grid">{children}</div>
    </section>
  );
}

export function PatientRegistrationPage() {
  const [form, setForm] = useState<PatientFormState>(emptyPatientForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [duplicatePatients, setDuplicatePatients] = useState<PatientResponse[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };

  const validateForm = (): FieldErrors => {
    const errs: FieldErrors = {};
    if (!form.firstName.trim()) {
      errs.firstName = 'First name is required';
    }
    if (!form.lastName.trim()) {
      errs.lastName = 'Last name is required';
    }
    if (!form.dateOfBirth) {
      errs.dateOfBirth = 'Date of birth is required';
    }
    if (!form.consent) {
      errs.consent = 'Patient consent is required before registration';
    }
    return errs;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const saveMode = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value;
    const errors = validateForm();

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError('Please fill in all required fields highlighted below.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    setDuplicatePatients([]);

    try {
      const patient = await patientsApi.create(toPatientPayload(form));
      showToast(`Patient ${patient.patient_number} registered successfully.`);
      if (saveMode === 'continue') {
        navigate(`/patients/documents?id=${encodeURIComponent(patient.id)}`);
      } else {
        navigate(`/patients/profile?id=${encodeURIComponent(patient.id)}`);
      }
    } catch (error) {
      const duplicates = getDuplicatePatients(error);
      setDuplicatePatients(duplicates);
      setFormError(getPatientErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const firstDuplicate = duplicatePatients[0];

  return (
    <>
      <div className="patient-content">
        <div className="patient-page-header">

          <button className="doc-btn" onClick={() => navigate('/patients/search')} type="button">
            <i className="ph ph-arrow-left" aria-hidden="true" /> Back
          </button>
        </div>

        <div className="patient-registration">
          {formError && (
            <div className={`patient-duplicate-alert ${duplicatePatients.length > 0 ? 'show' : 'show patient-error-alert'}`}>
              <i className="ph ph-warning" aria-hidden="true" />
              <div className="copy">
                <strong>{duplicatePatients.length > 0 ? 'Patient already exists' : 'Registration needs attention'}</strong>
                <p>
                  {duplicatePatients.length > 0 && firstDuplicate
                    ? `${patientFullName(firstDuplicate)} · ${firstDuplicate.patient_number} · ${firstDuplicate.phone || 'No phone'}`
                    : formError}
                </p>
              </div>
              {firstDuplicate && (
                <div className="doc-inline-actions">
                  <button
                    className="doc-btn"
                    onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(firstDuplicate.id)}`)}
                    type="button"
                  >
                    Open Profile
                  </button>
                  <button className="doc-btn" onClick={() => setDuplicatePatients([])} type="button">
                    Continue Review
                  </button>
                </div>
              )}
            </div>
          )}

          <form id="patient-registration-form" onSubmit={handleSubmit}>
            <RegistrationSection
              description="Identity, demographic and communication details"
              number={1}
              title="Personal Information"
            >
              <div className={`doc-field ${fieldErrors.firstName ? 'has-error' : ''}`}>
                <label htmlFor="patient-first-name">
                  First Name <span className="required-asterisk">*</span>
                </label>
                <input
                  disabled={submitting}
                  id="patient-first-name"
                  onChange={(event) => {
                    setForm({ ...form, firstName: event.target.value });
                    if (fieldErrors.firstName) setFieldErrors({ ...fieldErrors, firstName: undefined });
                  }}
                  type="text"
                  value={form.firstName}
                />
                {fieldErrors.firstName ? (
                  <span className="field-error-msg">
                    <i className="ph ph-warning-circle" aria-hidden="true" />
                    {fieldErrors.firstName}
                  </span>
                ) : null}
              </div>

              <div className="doc-field">
                <label htmlFor="patient-middle-name">Middle Name</label>
                <input
                  disabled={submitting}
                  id="patient-middle-name"
                  onChange={(event) => setForm({ ...form, middleName: event.target.value })}
                  type="text"
                  value={form.middleName}
                />
              </div>

              <div className={`doc-field ${fieldErrors.lastName ? 'has-error' : ''}`}>
                <label htmlFor="patient-last-name">
                  Last Name <span className="required-asterisk">*</span>
                </label>
                <input
                  disabled={submitting}
                  id="patient-last-name"
                  onChange={(event) => {
                    setForm({ ...form, lastName: event.target.value });
                    if (fieldErrors.lastName) setFieldErrors({ ...fieldErrors, lastName: undefined });
                  }}
                  type="text"
                  value={form.lastName}
                />
                {fieldErrors.lastName ? (
                  <span className="field-error-msg">
                    <i className="ph ph-warning-circle" aria-hidden="true" />
                    {fieldErrors.lastName}
                  </span>
                ) : null}
              </div>

              <div className="doc-field">
                <label htmlFor="patient-gender">
                  Gender <span className="required-asterisk">*</span>
                </label>
                <select
                  disabled={submitting}
                  id="patient-gender"
                  onChange={(event) => setForm({ ...form, gender: event.target.value as ApiPatientGender })}
                  value={form.gender}
                >
                  <option value="UNKNOWN">Unknown</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className={`doc-field ${fieldErrors.dateOfBirth ? 'has-error' : ''}`}>
                <label htmlFor="patient-dob">
                  Date of Birth <span className="required-asterisk">*</span>
                </label>
                <input
                  disabled={submitting}
                  id="patient-dob"
                  onChange={(event) => {
                    setForm({ ...form, dateOfBirth: event.target.value });
                    if (fieldErrors.dateOfBirth) setFieldErrors({ ...fieldErrors, dateOfBirth: undefined });
                  }}
                  type="date"
                  value={form.dateOfBirth}
                />
                {fieldErrors.dateOfBirth ? (
                  <span className="field-error-msg">
                    <i className="ph ph-warning-circle" aria-hidden="true" />
                    {fieldErrors.dateOfBirth}
                  </span>
                ) : null}
              </div>

              <div className="doc-field">
                <label htmlFor="patient-phone">Phone</label>
                <input
                  disabled={submitting}
                  id="patient-phone"
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  type="tel"
                  value={form.phone}
                />
              </div>

              <div className="doc-field">
                <label htmlFor="patient-email">Email</label>
                <input
                  disabled={submitting}
                  id="patient-email"
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  type="email"
                  value={form.email}
                />
              </div>
            </RegistrationSection>

            <RegistrationSection description="Residential and postal address" number={2} title="Contact Information">
              <div className="doc-field span-two">
                <label htmlFor="patient-address-line1">Address Line 1</label>
                <input
                  disabled={submitting}
                  id="patient-address-line1"
                  onChange={(event) => setForm({ ...form, addressLine1: event.target.value })}
                  type="text"
                  value={form.addressLine1}
                />
              </div>
              <div className="doc-field">
                <label htmlFor="patient-address-line2">Address Line 2</label>
                <input
                  disabled={submitting}
                  id="patient-address-line2"
                  onChange={(event) => setForm({ ...form, addressLine2: event.target.value })}
                  type="text"
                  value={form.addressLine2}
                />
              </div>
              <div className="doc-field">
                <label htmlFor="patient-city">City</label>
                <input
                  disabled={submitting}
                  id="patient-city"
                  onChange={(event) => setForm({ ...form, city: event.target.value })}
                  type="text"
                  value={form.city}
                />
              </div>
              <div className="doc-field">
                <label htmlFor="patient-state">County / State</label>
                <input
                  disabled={submitting}
                  id="patient-state"
                  onChange={(event) => setForm({ ...form, state: event.target.value })}
                  type="text"
                  value={form.state}
                />
              </div>
              <div className="doc-field">
                <label htmlFor="patient-country">Country</label>
                <input
                  disabled={submitting}
                  id="patient-country"
                  onChange={(event) => setForm({ ...form, country: event.target.value })}
                  type="text"
                  value={form.country}
                />
              </div>
              <div className="doc-field">
                <label htmlFor="patient-postal-code">Postal Code</label>
                <input
                  disabled={submitting}
                  id="patient-postal-code"
                  onChange={(event) => setForm({ ...form, postalCode: event.target.value })}
                  type="text"
                  value={form.postalCode}
                />
              </div>
            </RegistrationSection>

            <RegistrationSection
              description="Primary person to contact in an emergency"
              number={3}
              title="Emergency Contact"
            >
              <div className="doc-field">
                <label htmlFor="emergency-name">Name</label>
                <input
                  disabled={submitting}
                  id="emergency-name"
                  onChange={(event) => setForm({ ...form, emergencyName: event.target.value })}
                  type="text"
                  value={form.emergencyName}
                />
              </div>
              <div className="doc-field">
                <label htmlFor="emergency-relationship">Relationship</label>
                <input
                  disabled={submitting}
                  id="emergency-relationship"
                  onChange={(event) => setForm({ ...form, emergencyRelationship: event.target.value })}
                  type="text"
                  value={form.emergencyRelationship}
                />
              </div>
              <div className="doc-field">
                <label htmlFor="emergency-phone">Phone Number</label>
                <input
                  disabled={submitting}
                  id="emergency-phone"
                  onChange={(event) => setForm({ ...form, emergencyPhone: event.target.value })}
                  type="tel"
                  value={form.emergencyPhone}
                />
              </div>
            </RegistrationSection>

            <RegistrationSection
              description="Clinical alerts and registration notes"
              number={4}
              title="Medical Information"
            >
              <div className="doc-field">
                <label htmlFor="patient-blood-group">Blood Group</label>
                <input
                  disabled={submitting}
                  id="patient-blood-group"
                  onChange={(event) => setForm({ ...form, bloodGroup: event.target.value })}
                  placeholder="Example: O+"
                  type="text"
                  value={form.bloodGroup}
                />
              </div>
              <div className="doc-field full">
                <label htmlFor="patient-notes">Registration Notes</label>
                <textarea
                  disabled={submitting}
                  id="patient-notes"
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  rows={4}
                  value={form.notes}
                />
              </div>
              <div className="doc-field full">
                <label className="patient-consent-check full">
                  <input
                    checked={form.consent}
                    disabled={submitting}
                    onChange={(event) => {
                      setForm({ ...form, consent: event.target.checked });
                      if (fieldErrors.consent) setFieldErrors({ ...fieldErrors, consent: undefined });
                    }}
                    type="checkbox"
                  />
                  <span>
                    <strong>
                      Patient Consent <span className="required-asterisk">*</span>
                    </strong>
                    <small>The patient has consented to registration, care coordination and processing of health information.</small>
                  </span>
                </label>
                {fieldErrors.consent ? (
                  <span className="field-error-msg" style={{ marginTop: '0.2rem' }}>
                    <i className="ph ph-warning-circle" aria-hidden="true" />
                    {fieldErrors.consent}
                  </span>
                ) : null}
              </div>
            </RegistrationSection>

            <div className="patient-registration-actions">
              <button className="doc-btn" disabled={submitting} onClick={() => navigate('/patients/search')} type="button">
                Cancel
              </button>
              <button className="doc-btn" disabled={submitting} name="saveMode" type="submit" value="continue">
                Save & Continue
              </button>
              <button className="doc-btn primary" disabled={submitting} name="saveMode" type="submit" value="save">
                <i className="ph ph-check" aria-hidden="true" /> {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <Toast message={toastMessage} visible={toastVisible} />
    </>
  );
}
