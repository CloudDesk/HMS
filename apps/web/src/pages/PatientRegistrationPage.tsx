import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError } from '../api/api-error';
import {
  type ApiPatientGender,
  type PatientResponse,
  type SavePatientPayload,
} from '../api/patients';
import { Toast } from '../components/ui/Toast';
import { navigate } from '../routing/navigation';
import { getPatientErrorMessage, patientFullName } from './patient-utils';
import { usePatientRegistrationFeature } from '../hooks/patients/usePatientRegistrationFeature';

const nullable = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const patientRegistrationSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['UNKNOWN', 'MALE', 'FEMALE', 'OTHER']),
  phone: z.string().optional().refine(val => {
    if (!val || !val.trim()) return true;
    const cleaned = val.replace(/[\s\-()]/g, '');
    return /^(\+?(?:2[0-9]{2}|27|20|21[0-9]|22[0-9]|23[0-9]|24[0-9]|25[0-9]|26[0-9]|29[0-9])|0)?[0-9]{8,12}$/.test(cleaned);
  }, 'Please enter a valid African phone number (e.g. +233 24 123 4567)'),
  email: z.string().email('Invalid email').or(z.literal('')),
  registrationBranchId: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyRelationship: z.string().optional(),
  emergencyPhone: z.string().optional(),
  bloodGroup: z.string().optional(),
  notes: z.string().optional(),
  consent: z.boolean().refine(val => val === true, { message: 'Patient consent is required before registration' })
});

type PatientFormState = z.infer<typeof patientRegistrationSchema>;

const toPatientPayload = (form: PatientFormState): SavePatientPayload => ({
  first_name: form.firstName.trim(),
  middle_name: nullable(form.middleName),
  last_name: form.lastName.trim(),
  date_of_birth: form.dateOfBirth,
  gender: form.gender as ApiPatientGender,
  phone: nullable(form.phone),
  email: nullable(form.email),
  registration_branch_id: nullable(form.registrationBranchId),
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

type DuplicateDetails = {
  duplicates?: PatientResponse[];
};

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
  const form = useForm<PatientFormState>({
    resolver: zodResolver(patientRegistrationSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      middleName: '',
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
    }
  });

  const {
    state: { formError, duplicatePatients, toastMessage, toastVisible, toastTone },
    actions: { setFormError, setDuplicatePatients, setToastMessage, setToastVisible, setToastTone },
    mutations: { createPatient, submitting },
  } = usePatientRegistrationFeature(form);

  const { register, handleSubmit, formState: { errors } } = form;

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastTone(tone);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };

  const onSubmit = async (data: PatientFormState, event?: React.BaseSyntheticEvent) => {
    const saveMode = ((event?.nativeEvent as SubmitEvent)?.submitter as HTMLButtonElement | null)?.value;

    setFormError('');
    setDuplicatePatients([]);

    try {
      const patient = await createPatient(toPatientPayload(data));
      // Toast handles success in hook, but we need custom message here possibly or just rely on hook
      showToast(`Patient ${patient.patient_number} registered successfully.`);
      if (saveMode === 'continue') {
        navigate(`/patients/documents?id=${encodeURIComponent(patient.id)}`);
      } else {
        navigate(`/patients/profile?id=${encodeURIComponent(patient.id)}`);
      }
    } catch (error) {
      const duplicates = getDuplicatePatients(error);
      setDuplicatePatients(duplicates);
      if (!duplicates.length) {
        setFormError(getPatientErrorMessage(error));
      }
      showToast(getPatientErrorMessage(error), 'error');
    }
  };

  const onInvalid = () => {
    setFormError('Please fill in all required fields highlighted below.');
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

          <form id="patient-registration-form" onSubmit={handleSubmit(onSubmit, onInvalid)}>
            <RegistrationSection
              description="Identity, demographic and communication details"
              number={1}
              title="Personal Information"
            >
              <div className={`doc-field ${errors.firstName ? 'has-error' : ''}`}>
                <label htmlFor="patient-first-name">
                  First Name <span className="required-asterisk">*</span>
                </label>
                <input
                  disabled={submitting}
                  id="patient-first-name"
                  type="text"
                  {...register('firstName')}
                />
                {errors.firstName && (
                  <span className="field-error-msg">
                    <i className="ph ph-warning-circle" aria-hidden="true" />
                    {errors.firstName.message}
                  </span>
                )}
              </div>

              <div className="doc-field">
                <label htmlFor="patient-middle-name">Middle Name</label>
                <input
                  disabled={submitting}
                  id="patient-middle-name"
                  type="text"
                  {...register('middleName')}
                />
              </div>

              <div className={`doc-field ${errors.lastName ? 'has-error' : ''}`}>
                <label htmlFor="patient-last-name">
                  Last Name <span className="required-asterisk">*</span>
                </label>
                <input
                  disabled={submitting}
                  id="patient-last-name"
                  type="text"
                  {...register('lastName')}
                />
                {errors.lastName && (
                  <span className="field-error-msg">
                    <i className="ph ph-warning-circle" aria-hidden="true" />
                    {errors.lastName.message}
                  </span>
                )}
              </div>

              <div className="doc-field">
                <label htmlFor="patient-gender">
                  Gender <span className="required-asterisk">*</span>
                </label>
                <select
                  disabled={submitting}
                  id="patient-gender"
                  {...register('gender')}
                >
                  <option value="UNKNOWN">Unknown</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className={`doc-field ${errors.dateOfBirth ? 'has-error' : ''}`}>
                <label htmlFor="patient-dob">
                  Date of Birth <span className="required-asterisk">*</span>
                </label>
                <input
                  disabled={submitting}
                  id="patient-dob"
                  type="date"
                  {...register('dateOfBirth')}
                />
                {errors.dateOfBirth && (
                  <span className="field-error-msg">
                    <i className="ph ph-warning-circle" aria-hidden="true" />
                    {errors.dateOfBirth.message}
                  </span>
                )}
              </div>

              <div className={`doc-field ${errors.phone ? 'has-error' : ''}`}>
                <label htmlFor="patient-phone">Phone</label>
                <input
                  disabled={submitting}
                  id="patient-phone"
                  placeholder="e.g. +233 24 123 4567"
                  type="tel"
                  {...register('phone')}
                />
                {errors.phone && (
                  <span className="field-error-msg">
                    <i className="ph ph-warning-circle" aria-hidden="true" />
                    {errors.phone.message}
                  </span>
                )}
              </div>

              <div className={`doc-field ${errors.email ? 'has-error' : ''}`}>
                <label htmlFor="patient-email">Email</label>
                <input
                  disabled={submitting}
                  id="patient-email"
                  type="email"
                  {...register('email')}
                />
                {errors.email && (
                  <span className="field-error-msg">
                    <i className="ph ph-warning-circle" aria-hidden="true" />
                    {errors.email.message}
                  </span>
                )}
              </div>
            </RegistrationSection>

            <RegistrationSection description="Residential and postal address" number={2} title="Contact Information">
              <div className="doc-field span-two">
                <label htmlFor="patient-address-line1">Address Line 1</label>
                <input
                  disabled={submitting}
                  id="patient-address-line1"
                  type="text"
                  {...register('addressLine1')}
                />
              </div>
              <div className="doc-field">
                <label htmlFor="patient-address-line2">Address Line 2</label>
                <input
                  disabled={submitting}
                  id="patient-address-line2"
                  type="text"
                  {...register('addressLine2')}
                />
              </div>
              <div className="doc-field">
                <label htmlFor="patient-city">City</label>
                <input
                  disabled={submitting}
                  id="patient-city"
                  type="text"
                  {...register('city')}
                />
              </div>
              <div className="doc-field">
                <label htmlFor="patient-state">County / State</label>
                <input
                  disabled={submitting}
                  id="patient-state"
                  type="text"
                  {...register('state')}
                />
              </div>
              <div className="doc-field">
                <label htmlFor="patient-country">Country</label>
                <input
                  disabled={submitting}
                  id="patient-country"
                  type="text"
                  {...register('country')}
                />
              </div>
              <div className="doc-field">
                <label htmlFor="patient-postal-code">Postal Code</label>
                <input
                  disabled={submitting}
                  id="patient-postal-code"
                  type="text"
                  {...register('postalCode')}
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
                  type="text"
                  {...register('emergencyName')}
                />
              </div>
              <div className="doc-field">
                <label htmlFor="emergency-relationship">Relationship</label>
                <input
                  disabled={submitting}
                  id="emergency-relationship"
                  type="text"
                  {...register('emergencyRelationship')}
                />
              </div>
              <div className="doc-field">
                <label htmlFor="emergency-phone">Phone Number</label>
                <input
                  disabled={submitting}
                  id="emergency-phone"
                  type="tel"
                  {...register('emergencyPhone')}
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
                  placeholder="Example: O+"
                  type="text"
                  {...register('bloodGroup')}
                />
              </div>
              <div className="doc-field full">
                <label htmlFor="patient-notes">Registration Notes</label>
                <textarea
                  disabled={submitting}
                  id="patient-notes"
                  rows={4}
                  {...register('notes')}
                />
              </div>
              <div className="doc-field full">
                <label className="patient-consent-check full">
                  <input
                    disabled={submitting}
                    type="checkbox"
                    {...register('consent')}
                  />
                  <span>
                    <strong>
                      Patient Consent <span className="required-asterisk">*</span>
                    </strong>
                    <small>The patient has consented to registration, care coordination and processing of health information.</small>
                  </span>
                </label>
                {errors.consent && (
                  <span className="field-error-msg" style={{ marginTop: '0.2rem' }}>
                    <i className="ph ph-warning-circle" aria-hidden="true" />
                    {errors.consent.message}
                  </span>
                )}
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

      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />
    </>
  );
}
