import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../api/api-error';
import {
  type ApiPatientGender,
  type PatientResponse,
  type SavePatientPayload,
} from '../api/patients';
import { Toast } from '../components/ui/Toast';
import { MedicalSpinner } from '../components/ui/MedicalLoader';
import { usePatientRegistrationFeature } from '../hooks/patients/usePatientRegistrationFeature';
import { navigate } from '../routing/navigation';
import { getPatientErrorMessage, patientFullName } from './patient-utils';

type PatientFormState = {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  parentGuardian: string;
  gender: ApiPatientGender;
  phone: string;
  email: string;
  registrationBranchId: string;
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
  parentGuardian?: string;
  gender?: string;
  phone?: string;
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
  parentGuardian: '',
  gender: 'UNKNOWN',
  phone: '',
  email: '',
  registrationBranchId: '',
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
  consent: true,
};

const COUNTRY_CODES = [
  { code: '+233', flag: '🇬🇭', label: 'Ghana (+233)' },
  { code: '+254', flag: '🇰🇪', label: 'Kenya (+254)' },
  { code: '+234', flag: '🇳🇬', label: 'Nigeria (+234)' },
  { code: '+27', flag: '🇿🇦', label: 'South Africa (+27)' },
  { code: '+91', flag: '🇮🇳', label: 'India (+91)' },
  { code: '+44', flag: '🇬🇧', label: 'UK (+44)' },
  { code: '+1', flag: '🇺🇸', label: 'USA (+1)' },
  { code: '+971', flag: '🇦🇪', label: 'UAE (+971)' },
];

function CountryFlagIcon({ code }: { code: string }) {
  switch (code) {
    case '+233': // Ghana (Red, Gold with black star, Green)
      return (
        <svg aria-hidden="true" height="13" style={{ borderRadius: '2px', flexShrink: 0, boxShadow: '0 0 1px rgba(0,0,0,0.4)' }} viewBox="0 0 20 14" width="19">
          <rect fill="#CE1126" height="4.67" width="20" />
          <rect fill="#FCD116" height="4.67" width="20" y="4.67" />
          <rect fill="#006B3F" height="4.67" width="20" y="9.33" />
          <polygon fill="#000000" points="10,5.0 10.7,6.8 12.4,6.8 11.1,7.9 11.6,9.6 10,8.5 8.4,9.6 8.9,7.9 7.6,6.8 9.3,6.8" />
        </svg>
      );
    case '+254': // Kenya
      return (
        <svg aria-hidden="true" height="13" style={{ borderRadius: '2px', flexShrink: 0, boxShadow: '0 0 1px rgba(0,0,0,0.4)' }} viewBox="0 0 20 14" width="19">
          <rect fill="#000000" height="4.2" width="20" />
          <rect fill="#FFFFFF" height="5.6" width="20" y="4.2" />
          <rect fill="#BB0000" height="4.2" width="20" y="4.9" />
          <rect fill="#FFFFFF" height="1" width="20" y="9.1" />
          <rect fill="#006600" height="4.2" width="20" y="9.8" />
          <ellipse cx="10" cy="7" fill="#BB0000" rx="2.5" ry="4" stroke="#FFFFFF" strokeWidth="0.5" />
        </svg>
      );
    case '+234': // Nigeria
      return (
        <svg aria-hidden="true" height="13" style={{ borderRadius: '2px', flexShrink: 0, boxShadow: '0 0 1px rgba(0,0,0,0.4)' }} viewBox="0 0 20 14" width="19">
          <rect fill="#008751" height="14" width="6.67" />
          <rect fill="#FFFFFF" height="14" width="6.67" x="6.67" />
          <rect fill="#008751" height="14" width="6.67" x="13.33" />
        </svg>
      );
    case '+27': // South Africa
      return (
        <svg aria-hidden="true" height="13" style={{ borderRadius: '2px', flexShrink: 0, boxShadow: '0 0 1px rgba(0,0,0,0.4)' }} viewBox="0 0 20 14" width="19">
          <rect fill="#E03C31" height="7" width="20" />
          <rect fill="#001489" height="7" width="20" y="7" />
          <polygon fill="#007749" points="0,0 9,7 0,14" />
          <polygon fill="#FFB81C" points="0,2 6.5,7 0,12" stroke="#000000" strokeWidth="0.4" />
          <polygon fill="#000000" points="0,3 5,7 0,11" />
        </svg>
      );
    case '+91': // India
      return (
        <svg aria-hidden="true" height="13" style={{ borderRadius: '2px', flexShrink: 0, boxShadow: '0 0 1px rgba(0,0,0,0.4)' }} viewBox="0 0 20 14" width="19">
          <rect fill="#FF9933" height="4.67" width="20" />
          <rect fill="#FFFFFF" height="4.67" width="20" y="4.67" />
          <rect fill="#138808" height="4.67" width="20" y="9.33" />
          <circle cx="10" cy="7" fill="none" r="1.8" stroke="#000080" strokeWidth="0.6" />
        </svg>
      );
    case '+44': // UK
      return (
        <svg aria-hidden="true" height="13" style={{ borderRadius: '2px', flexShrink: 0, boxShadow: '0 0 1px rgba(0,0,0,0.4)' }} viewBox="0 0 20 14" width="19">
          <rect fill="#012169" height="14" width="20" />
          <path d="M0,0 L20,14 M20,0 L0,14" stroke="#FFFFFF" strokeWidth="2.5" />
          <path d="M0,0 L20,14 M20,0 L0,14" stroke="#C8102E" strokeWidth="1.2" />
          <path d="M10,0 V14 M0,7 H20" stroke="#FFFFFF" strokeWidth="4" />
          <path d="M10,0 V14 M0,7 H20" stroke="#C8102E" strokeWidth="2.4" />
        </svg>
      );
    case '+1': // USA
      return (
        <svg aria-hidden="true" height="13" style={{ borderRadius: '2px', flexShrink: 0, boxShadow: '0 0 1px rgba(0,0,0,0.4)' }} viewBox="0 0 20 14" width="19">
          <rect fill="#B22234" height="14" width="20" />
          <rect fill="#FFFFFF" height="1.08" width="20" y="1.08" />
          <rect fill="#FFFFFF" height="1.08" width="20" y="3.24" />
          <rect fill="#FFFFFF" height="1.08" width="20" y="5.4" />
          <rect fill="#FFFFFF" height="1.08" width="20" y="7.56" />
          <rect fill="#FFFFFF" height="1.08" width="20" y="9.72" />
          <rect fill="#FFFFFF" height="1.08" width="20" y="11.88" />
          <rect fill="#3C3B6E" height="7.56" width="8" />
        </svg>
      );
    case '+971': // UAE
      return (
        <svg aria-hidden="true" height="13" style={{ borderRadius: '2px', flexShrink: 0, boxShadow: '0 0 1px rgba(0,0,0,0.4)' }} viewBox="0 0 20 14" width="19">
          <rect fill="#00732F" height="4.67" width="20" />
          <rect fill="#FFFFFF" height="4.67" width="20" y="4.67" />
          <rect fill="#000000" height="4.67" width="20" y="9.33" />
          <rect fill="#FF0000" height="14" width="5" />
        </svg>
      );
    default:
      return <i aria-hidden="true" className="ph ph-globe" style={{ fontSize: '1.05rem', color: '#64748b' }} />;
  }
}

const COUNTRIES = [
  'Ghana',
  'Kenya',
  'Nigeria',
  'South Africa',
  'India',
  'Uganda',
  'Tanzania',
  'Rwanda',
  'Ethiopia',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Other',
];

const RELATIONSHIPS = [
  'Spouse',
  'Parent',
  'Sibling',
  'Child',
  'Guardian',
  'Friend',
  'Relative',
  'Other',
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const nullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const isValidAfricanPhone = (phone: string): boolean => {
  if (!phone || !phone.trim()) return true;
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return /^(\+?(?:2[0-9]{2}|27|20|21[0-9]|22[0-9]|23[0-9]|24[0-9]|25[0-9]|26[0-9]|29[0-9])|0)?[0-9]{8,12}$/.test(cleaned);
};

const toPatientPayload = (form: PatientFormState): SavePatientPayload => ({
  first_name: nullable(form.firstName),
  middle_name: nullable(form.middleName),
  last_name: form.lastName.trim(),
  date_of_birth: form.dateOfBirth,
  gender: form.gender,
  parent_guardian: nullable(form.parentGuardian),
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
  title: string;
  icon: string;
  theme: 'blue' | 'teal' | 'orange' | 'purple';
};

function RegistrationSection({ children, description, title, icon, theme }: RegistrationSectionProps) {
  return (
    <section className={`patient-reg-section theme-${theme}`}>
      <div className="patient-reg-section-header">
        <div className="patient-reg-section-icon">
          <i className={`ph ${icon}`} aria-hidden="true" />
        </div>
        <div className="patient-reg-section-titles">
          <h3 className="patient-reg-section-title">{title}</h3>
          <p className="patient-reg-section-subtitle">{description}</p>
        </div>
      </div>
      <div className="patient-reg-section-body">{children}</div>
    </section>
  );
}

type PatientRegistrationPageProps = {
  embedded?: boolean;
  onCancel?: () => void;
  onRegistered?: (patient: PatientResponse) => void;
};

export function PatientRegistrationPage({
  embedded = false,
  onCancel,
  onRegistered,
}: PatientRegistrationPageProps = {}) {
  const [form, setForm] = useState<PatientFormState>(emptyPatientForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [duplicatePatients, setDuplicatePatients] = useState<PatientResponse[]>([]);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');

  const [phoneCountryCode, setPhoneCountryCode] = useState('+233');
  const [phoneRaw, setPhoneRaw] = useState('');
  const [emergencyPhoneCountryCode, setEmergencyPhoneCountryCode] = useState('+233');
  const [emergencyPhoneRaw, setEmergencyPhoneRaw] = useState('');

  const handleRegistrationBranchChange = useCallback((branchId: string) => {
    setForm((previous) => ({ ...previous, registrationBranchId: branchId }));
  }, []);
  const feature = usePatientRegistrationFeature({
    registrationBranchId: form.registrationBranchId,
    onRegistrationBranchChange: handleRegistrationBranchChange,
  });
  const { submitting } = feature.state;
  const { registerPatient } = feature.actions;

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastTone(tone);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };

  const handlePhoneChange = (raw: string, code: string) => {
    setPhoneRaw(raw);
    setPhoneCountryCode(code);
    const trimmed = raw.trim();
    if (!trimmed) {
      setForm((prev) => ({ ...prev, phone: '' }));
    } else if (trimmed.startsWith('+')) {
      setForm((prev) => ({ ...prev, phone: trimmed }));
    } else {
      setForm((prev) => ({ ...prev, phone: `${code} ${trimmed}` }));
    }
    if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }));
  };

  const handleEmergencyPhoneChange = (raw: string, code: string) => {
    setEmergencyPhoneRaw(raw);
    setEmergencyPhoneCountryCode(code);
    const trimmed = raw.trim();
    if (!trimmed) {
      setForm((prev) => ({ ...prev, emergencyPhone: '' }));
    } else if (trimmed.startsWith('+')) {
      setForm((prev) => ({ ...prev, emergencyPhone: trimmed }));
    } else {
      setForm((prev) => ({ ...prev, emergencyPhone: `${code} ${trimmed}` }));
    }
  };

  const calculateAge = (dob: string) => {
    if (!dob) return null;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.abs(new Date(diff).getUTCFullYear() - 1970);
  };

  const validateForm = (): FieldErrors => {
    const errs: FieldErrors = {};
    if (!form.lastName.trim()) {
      errs.lastName = 'Last name is required';
    }
    if (!form.gender || form.gender === 'UNKNOWN') {
      errs.gender = 'Gender is required';
    }
    if (!form.dateOfBirth) {
      errs.dateOfBirth = 'Date of birth is required';
    } else {
      const dobTime = new Date(form.dateOfBirth).getTime();
      if (Number.isNaN(dobTime) || dobTime > Date.now()) {
        errs.dateOfBirth = 'Date of birth cannot be in the future';
      }
    }
    const age = calculateAge(form.dateOfBirth);
    const showParentGuardian = age !== null && age < 16;
    if (showParentGuardian && !form.parentGuardian.trim()) {
      errs.parentGuardian = 'Parent/Guardian name is required for patients under 16';
    }
    if (!form.phone.trim()) {
      errs.phone = 'Phone number is required';
    } else if (!isValidAfricanPhone(form.phone)) {
      errs.phone = 'Please enter a valid African phone number (e.g. +233 24 123 4567 or 0241234567)';
    }
    if (!form.consent) {
      errs.consent = 'Patient consent is required before registration';
    }
    return errs;
  };

  const isFormValid = useMemo(() => {
    if (!form.lastName.trim()) return false;
    if (!form.gender || form.gender === 'UNKNOWN') return false;
    if (!form.dateOfBirth || !form.dateOfBirth.trim()) return false;
    const dobTime = new Date(form.dateOfBirth).getTime();
    if (Number.isNaN(dobTime) || dobTime > Date.now()) return false;
    const age = calculateAge(form.dateOfBirth);
    if (age !== null && age < 16 && !form.parentGuardian.trim()) return false;
    if (!form.phone.trim() || !isValidAfricanPhone(form.phone)) return false;
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return false;
    if (!form.consent) return false;
    return true;
  }, [form]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const saveMode = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value;
    const errors = validateForm();

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError('Please fill in all required fields highlighted below.');
      return;
    }

    setFormError('');
    setDuplicatePatients([]);

    try {
      const patient = await registerPatient(toPatientPayload(form));
      showToast(`Patient ${patient.patient_number} registered successfully.`);
      if (onRegistered) {
        onRegistered(patient);
      } else if (saveMode === 'continue') {
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

  const firstDuplicate = duplicatePatients[0];

  const age = calculateAge(form.dateOfBirth);
  const showParentGuardian = age !== null && age < 16;
  const cancelRegistration = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    navigate('/patients/search');
  };

  return (
    <>
      <div className={embedded ? 'patient-registration-embedded' : 'patient-content'}>
        {!embedded ? (
          <div className="patient-reg-page-header">
            <div className="patient-reg-modal-header centered">
              <h3 className="patient-reg-modal-title">Register Patient</h3>
            </div>
            <button className="doc-btn" onClick={cancelRegistration} type="button">
              <i className="ph ph-arrow-left" aria-hidden="true" /> Back
            </button>
          </div>
        ) : null}

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
            {/* Section A: Personal Information */}
            <RegistrationSection
              description="Identity, demographic and communication details"
              icon="ph-user"
              theme="blue"
              title="Personal Information"
            >
              <div className="patient-reg-grid-3">
                <div className={`patient-reg-field ${fieldErrors.firstName ? 'has-error' : ''}`}>
                  <label className="patient-reg-label" htmlFor="patient-first-name">
                    First Name
                  </label>
                  <div className={`patient-reg-input-group ${fieldErrors.firstName ? 'has-error' : ''}`}>
                    <div className="patient-reg-leading-icon">
                      <i className="ph ph-user" aria-hidden="true" />
                    </div>
                    <input
                      className="patient-reg-input"
                      disabled={submitting}
                      id="patient-first-name"
                      onChange={(event) => {
                        setForm({ ...form, firstName: event.target.value });
                        if (fieldErrors.firstName) setFieldErrors({ ...fieldErrors, firstName: undefined });
                      }}
                      placeholder="Enter first name"
                      type="text"
                      value={form.firstName}
                    />
                  </div>
                  {fieldErrors.firstName ? (
                    <span className="patient-reg-error">
                      <i className="ph ph-warning-circle" aria-hidden="true" />
                      {fieldErrors.firstName}
                    </span>
                  ) : null}
                </div>

                <div className="patient-reg-field">
                  <label className="patient-reg-label" htmlFor="patient-middle-name">Middle Name</label>
                  <div className="patient-reg-input-group">
                    <div className="patient-reg-leading-icon">
                      <i className="ph ph-user" aria-hidden="true" />
                    </div>
                    <input
                      className="patient-reg-input"
                      disabled={submitting}
                      id="patient-middle-name"
                      onChange={(event) => setForm({ ...form, middleName: event.target.value })}
                      placeholder="Enter middle name"
                      type="text"
                      value={form.middleName}
                    />
                  </div>
                </div>

                <div className={`patient-reg-field ${fieldErrors.lastName ? 'has-error' : ''}`}>
                  <label className="patient-reg-label" htmlFor="patient-last-name">
                    Last Name <span className="patient-reg-required">*</span>
                  </label>
                  <div className={`patient-reg-input-group ${fieldErrors.lastName ? 'has-error' : ''}`}>
                    <div className="patient-reg-leading-icon">
                      <i className="ph ph-user" aria-hidden="true" />
                    </div>
                    <input
                      className="patient-reg-input"
                      disabled={submitting}
                      id="patient-last-name"
                      onChange={(event) => {
                        setForm({ ...form, lastName: event.target.value });
                        if (fieldErrors.lastName) setFieldErrors({ ...fieldErrors, lastName: undefined });
                      }}
                      placeholder="Enter last name"
                      type="text"
                      value={form.lastName}
                    />
                  </div>
                  {fieldErrors.lastName ? (
                    <span className="patient-reg-error">
                      <i className="ph ph-warning-circle" aria-hidden="true" />
                      {fieldErrors.lastName}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="patient-reg-grid-3">
                <div className="patient-reg-field">
                  <label className="patient-reg-label" htmlFor="patient-gender">
                    Gender <span className="patient-reg-required">*</span>
                  </label>
                  <div className="patient-reg-input-group">
                    <div className="patient-reg-leading-icon">
                      <i className="ph ph-user" aria-hidden="true" />
                    </div>
                    <div className="patient-reg-select-wrapper">
                      <select
                        className="patient-reg-select"
                        disabled={submitting}
                        id="patient-gender"
                        onChange={(event) => setForm({ ...form, gender: event.target.value as ApiPatientGender })}
                        value={form.gender}
                      >
                        <option value="UNKNOWN">Select gender</option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                      <i className="ph ph-caret-down patient-reg-trailing-icon" aria-hidden="true" />
                    </div>
                  </div>
                </div>

                <div className={`patient-reg-field ${fieldErrors.dateOfBirth ? 'has-error' : ''}`}>
                  <label className="patient-reg-label" htmlFor="patient-dob">
                    Date of Birth <span className="patient-reg-required">*</span>
                  </label>
                  <div className={`patient-reg-input-group ${fieldErrors.dateOfBirth ? 'has-error' : ''}`}>
                    <div className="patient-reg-leading-icon">
                      <i className="ph ph-calendar" aria-hidden="true" />
                    </div>
                    <input
                      className="patient-reg-input"
                      disabled={submitting}
                      id="patient-dob"
                      onChange={(event) => {
                        setForm({ ...form, dateOfBirth: event.target.value });
                        if (fieldErrors.dateOfBirth) setFieldErrors({ ...fieldErrors, dateOfBirth: undefined });
                      }}
                      placeholder="dd - mm - yyyy"
                      type="date"
                      value={form.dateOfBirth}
                    />
                  </div>
                  {fieldErrors.dateOfBirth ? (
                    <span className="patient-reg-error">
                      <i className="ph ph-warning-circle" aria-hidden="true" />
                      {fieldErrors.dateOfBirth}
                    </span>
                  ) : null}
                </div>

                <div className={`patient-reg-field ${fieldErrors.parentGuardian ? 'has-error' : ''}`}>
                  <label className="patient-reg-label" htmlFor="patient-parent-guardian">
                    Parent/Guardian Name
                    {showParentGuardian ? <span className="patient-reg-required">*</span> : null}
                  </label>
                  <div className={`patient-reg-input-group ${fieldErrors.parentGuardian ? 'has-error' : ''}`}>
                    <div className="patient-reg-leading-icon">
                      <i className="ph ph-user" aria-hidden="true" />
                    </div>
                    <input
                      className="patient-reg-input"
                      disabled={submitting}
                      id="patient-parent-guardian"
                      onChange={(event) => {
                        setForm({ ...form, parentGuardian: event.target.value });
                        if (fieldErrors.parentGuardian) setFieldErrors({ ...fieldErrors, parentGuardian: undefined });
                      }}
                      placeholder="Enter parent or guardian name"
                      type="text"
                      value={form.parentGuardian}
                    />
                  </div>
                  {fieldErrors.parentGuardian ? (
                    <span className="patient-reg-error">
                      <i className="ph ph-warning-circle" aria-hidden="true" />
                      {fieldErrors.parentGuardian}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="patient-reg-grid-2">
                <div className={`patient-reg-field ${fieldErrors.phone ? 'has-error' : ''}`}>
                  <label className="patient-reg-label" htmlFor="patient-phone">
                    Phone <span className="patient-reg-required">*</span>
                  </label>
                  <div className={`patient-reg-input-group ${fieldErrors.phone ? 'has-error' : ''}`}>
                    <div className="patient-reg-leading-icon">
                      <i className="ph ph-phone" aria-hidden="true" />
                    </div>
                    <div className="patient-reg-country-select-wrapper">
                      <span className="patient-reg-flag"><CountryFlagIcon code={phoneCountryCode} /></span>
                      <select
                        aria-label="Country code"
                        className="patient-reg-country-select"
                        disabled={submitting}
                        onChange={(e) => handlePhoneChange(phoneRaw, e.target.value)}
                        value={phoneCountryCode}
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code}
                          </option>
                        ))}
                      </select>
                      <i className="ph ph-caret-down patient-reg-caret" aria-hidden="true" />
                    </div>
                    <div className="patient-reg-phone-divider" />
                    <input
                      className="patient-reg-input"
                      disabled={submitting}
                      id="patient-phone"
                      onChange={(event) => handlePhoneChange(event.target.value, phoneCountryCode)}
                      placeholder="24 123 4567"
                      required
                      type="tel"
                      value={phoneRaw}
                    />
                  </div>
                  {fieldErrors.phone ? (
                    <span className="patient-reg-error">
                      <i className="ph ph-warning-circle" aria-hidden="true" />
                      {fieldErrors.phone}
                    </span>
                  ) : null}
                </div>

                <div className="patient-reg-field">
                  <label className="patient-reg-label" htmlFor="patient-email">Email</label>
                  <div className="patient-reg-input-group">
                    <div className="patient-reg-leading-icon">
                      <i className="ph ph-envelope" aria-hidden="true" />
                    </div>
                    <input
                      className="patient-reg-input"
                      disabled={submitting}
                      id="patient-email"
                      onChange={(event) => setForm({ ...form, email: event.target.value })}
                      placeholder="Enter email address"
                      type="email"
                      value={form.email}
                    />
                  </div>
                </div>
              </div>
            </RegistrationSection>

            {/* Section B: Contact Information */}
            <RegistrationSection
              description="Residential and postal address"
              icon="ph-house"
              theme="teal"
              title="Contact Information"
            >
              <div className="patient-reg-grid-2">
                <div className="patient-reg-field">
                  <label className="patient-reg-label" htmlFor="patient-address-line1">Address Line 1</label>
                  <div className="patient-reg-input-group">
                    <div className="patient-reg-leading-icon">
                      <i className="ph ph-house" aria-hidden="true" />
                    </div>
                    <input
                      className="patient-reg-input"
                      disabled={submitting}
                      id="patient-address-line1"
                      onChange={(event) => setForm({ ...form, addressLine1: event.target.value })}
                      placeholder="Enter address line 1"
                      type="text"
                      value={form.addressLine1}
                    />
                  </div>
                </div>

                <div className="patient-reg-field">
                  <label className="patient-reg-label" htmlFor="patient-address-line2">Address Line 2</label>
                  <div className="patient-reg-input-group">
                    <div className="patient-reg-leading-icon">
                      <i className="ph ph-house" aria-hidden="true" />
                    </div>
                    <input
                      className="patient-reg-input"
                      disabled={submitting}
                      id="patient-address-line2"
                      onChange={(event) => setForm({ ...form, addressLine2: event.target.value })}
                      placeholder="Enter address line 2"
                      type="text"
                      value={form.addressLine2}
                    />
                  </div>
                </div>
              </div>

              <div className="patient-reg-grid-4">
                <div className="patient-reg-field">
                  <label className="patient-reg-label" htmlFor="patient-city">City</label>
                  <div className="patient-reg-input-group">
                    <div className="patient-reg-leading-icon">
                      <i className="ph ph-buildings" aria-hidden="true" />
                    </div>
                    <input
                      className="patient-reg-input"
                      disabled={submitting}
                      id="patient-city"
                      onChange={(event) => setForm({ ...form, city: event.target.value })}
                      placeholder="Enter city"
                      type="text"
                      value={form.city}
                    />
                  </div>
                </div>

                <div className="patient-reg-field">
                  <label className="patient-reg-label" htmlFor="patient-state">State</label>
                  <div className="patient-reg-input-group">
                    <div className="patient-reg-leading-icon">
                      <i className="ph ph-map-trifold" aria-hidden="true" />
                    </div>
                    <input
                      className="patient-reg-input"
                      disabled={submitting}
                      id="patient-state"
                      onChange={(event) => setForm({ ...form, state: event.target.value })}
                      placeholder="Enter state"
                      type="text"
                      value={form.state}
                    />
                  </div>
                </div>

                <div className="patient-reg-field">
                  <label className="patient-reg-label" htmlFor="patient-country">Country</label>
                  <div className="patient-reg-input-group">
                    <div className="patient-reg-leading-icon">
                      <i className="ph ph-globe" aria-hidden="true" />
                    </div>
                    <div className="patient-reg-select-wrapper">
                      <select
                        className="patient-reg-select"
                        disabled={submitting}
                        id="patient-country"
                        onChange={(event) => setForm({ ...form, country: event.target.value })}
                        value={form.country}
                      >
                        <option value="">Select country</option>
                        {COUNTRIES.map((country) => (
                          <option key={country} value={country}>
                            {country}
                          </option>
                        ))}
                      </select>
                      <i className="ph ph-caret-down patient-reg-trailing-icon" aria-hidden="true" />
                    </div>
                  </div>
                </div>

                <div className="patient-reg-field">
                  <label className="patient-reg-label" htmlFor="patient-postal-code">Postal Code</label>
                  <div className="patient-reg-input-group">
                    <div className="patient-reg-leading-icon">
                      <i className="ph ph-map-pin" aria-hidden="true" />
                    </div>
                    <input
                      className="patient-reg-input"
                      disabled={submitting}
                      id="patient-postal-code"
                      onChange={(event) => setForm({ ...form, postalCode: event.target.value })}
                      placeholder="Enter postal code"
                      type="text"
                      value={form.postalCode}
                    />
                  </div>
                </div>
              </div>
            </RegistrationSection>

            {/* Section C: Emergency Contact */}
            <RegistrationSection
              description="Primary person to contact in an emergency"
              icon="ph-users"
              theme="orange"
              title="Emergency Contact"
            >
              <div className="patient-reg-grid-3">
                <div className="patient-reg-field">
                  <label className="patient-reg-label" htmlFor="emergency-name">Name</label>
                  <div className="patient-reg-input-group">
                    <div className="patient-reg-leading-icon">
                      <i className="ph ph-user" aria-hidden="true" />
                    </div>
                    <input
                      className="patient-reg-input"
                      disabled={submitting}
                      id="emergency-name"
                      onChange={(event) => setForm({ ...form, emergencyName: event.target.value })}
                      placeholder="Enter contact name"
                      type="text"
                      value={form.emergencyName}
                    />
                  </div>
                </div>

                <div className="patient-reg-field">
                  <label className="patient-reg-label" htmlFor="emergency-relationship">Relationship</label>
                  <div className="patient-reg-input-group">
                    <div className="patient-reg-leading-icon">
                      <i className="ph ph-users" aria-hidden="true" />
                    </div>
                    <div className="patient-reg-select-wrapper">
                      <select
                        className="patient-reg-select"
                        disabled={submitting}
                        id="emergency-relationship"
                        onChange={(event) => setForm({ ...form, emergencyRelationship: event.target.value })}
                        value={form.emergencyRelationship}
                      >
                        <option value="">Select relationship</option>
                        {RELATIONSHIPS.map((rel) => (
                          <option key={rel} value={rel}>
                            {rel}
                          </option>
                        ))}
                      </select>
                      <i className="ph ph-caret-down patient-reg-trailing-icon" aria-hidden="true" />
                    </div>
                  </div>
                </div>

                <div className="patient-reg-field">
                  <label className="patient-reg-label" htmlFor="emergency-phone">Phone Number</label>
                  <div className="patient-reg-input-group">
                    <div className="patient-reg-leading-icon">
                      <i className="ph ph-phone" aria-hidden="true" />
                    </div>
                    <div className="patient-reg-country-select-wrapper">
                      <span className="patient-reg-flag"><CountryFlagIcon code={emergencyPhoneCountryCode} /></span>
                      <select
                        aria-label="Emergency contact country code"
                        className="patient-reg-country-select"
                        disabled={submitting}
                        onChange={(e) => handleEmergencyPhoneChange(emergencyPhoneRaw, e.target.value)}
                        value={emergencyPhoneCountryCode}
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code}
                          </option>
                        ))}
                      </select>
                      <i className="ph ph-caret-down patient-reg-caret" aria-hidden="true" />
                    </div>
                    <div className="patient-reg-phone-divider" />
                    <input
                      className="patient-reg-input"
                      disabled={submitting}
                      id="emergency-phone"
                      onChange={(event) => handleEmergencyPhoneChange(event.target.value, emergencyPhoneCountryCode)}
                      placeholder="24 123 4567"
                      type="tel"
                      value={emergencyPhoneRaw}
                    />
                  </div>
                </div>
              </div>
            </RegistrationSection>

            {/* Section D: Medical Information */}
            <RegistrationSection
              description="Clinical alerts and registration notes"
              icon="ph-heart"
              theme="purple"
              title="Medical Information"
            >
              <div className="patient-reg-grid-medical">
                <div className="patient-reg-field">
                  <label className="patient-reg-label" htmlFor="patient-blood-group">Blood Group</label>
                  <div className="patient-reg-input-group">
                    <div className="patient-reg-leading-icon">
                      <i className="ph ph-drop" aria-hidden="true" />
                    </div>
                    <div className="patient-reg-select-wrapper">
                      <select
                        className="patient-reg-select"
                        disabled={submitting}
                        id="patient-blood-group"
                        onChange={(event) => setForm({ ...form, bloodGroup: event.target.value })}
                        value={form.bloodGroup}
                      >
                        <option value="">Select blood group</option>
                        {BLOOD_GROUPS.map((bg) => (
                          <option key={bg} value={bg}>
                            {bg}
                          </option>
                        ))}
                      </select>
                      <i className="ph ph-caret-down patient-reg-trailing-icon" aria-hidden="true" />
                    </div>
                  </div>
                </div>

                <div className="patient-reg-field">
                  <label className="patient-reg-label" htmlFor="patient-notes">Registration Notes</label>
                  <div className="patient-reg-input-group patient-reg-notes-group">
                    <div className="patient-reg-leading-icon">
                      <i className="ph ph-file-text" aria-hidden="true" />
                    </div>
                    <input
                      className="patient-reg-input"
                      disabled={submitting}
                      id="patient-notes"
                      maxLength={500}
                      onChange={(event) => setForm({ ...form, notes: event.target.value })}
                      placeholder="Enter any clinical alerts, allergies or additional notes..."
                      type="text"
                      value={form.notes}
                    />
                    <span className="patient-reg-char-counter">{form.notes.length}/500</span>
                  </div>
                </div>
              </div>

              {/* Accessible consent agreement confirmation row */}
              <div className="patient-reg-consent-row">
                <label className="patient-reg-consent-label">
                  <input
                    checked={form.consent}
                    disabled={submitting}
                    onChange={(event) => {
                      setForm({ ...form, consent: event.target.checked });
                      if (fieldErrors.consent) setFieldErrors({ ...fieldErrors, consent: undefined });
                    }}
                    type="checkbox"
                  />
                  <span>Patient has consented to registration, care coordination and health data processing</span>
                </label>
                {fieldErrors.consent ? (
                  <span className="patient-reg-error">
                    <i className="ph ph-warning-circle" aria-hidden="true" />
                    {fieldErrors.consent}
                  </span>
                ) : null}
              </div>
            </RegistrationSection>

            {/* Bottom Action Bar */}
            <div className="patient-registration-actions">
              <button className="doc-btn" disabled={submitting} onClick={cancelRegistration} type="button">
                Cancel
              </button>
              <button
                className="doc-btn primary"
                disabled={submitting || !isFormValid}
                name="saveMode"
                type="submit"
                value="save"
              >
                {submitting ? (
                  <>
                    <MedicalSpinner size="sm" />
                    <span>Registering Patient...</span>
                  </>
                ) : (
                  <>
                    <i className="ph ph-check" aria-hidden="true" /> Save Patient
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />
    </>
  );
}
