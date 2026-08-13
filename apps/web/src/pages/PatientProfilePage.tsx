import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { appointmentsApi, type AppointmentResponse } from '../api/appointments';
import {
  patientsApi,
  type ApiPatientGender,
  type ApiPatientStatus,
  type PatientHistoryResponse,
  type PatientResponse,
  type SavePatientPayload,
} from '../api/patients';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { navigate, useAppLocation } from '../routing/navigation';
import { patientInitials } from './opd-utils';
import { formatDate, formatDateTime, getPatientErrorMessage, getPatientIdFromSearch, patientFullName } from './patient-utils';

type ProfileForm = {
  bloodGroup: string;
  dateOfBirth: string;
  email: string;
  firstName: string;
  gender: ApiPatientGender;
  lastName: string;
  notes: string;
  phone: string;
  status: ApiPatientStatus;
};

const tabs = [
  'Overview',
  'Medical History',
  'Visits',
  'Appointments',
  'Medications',
  'Lab Results',
  'Imaging',
  'Documents',
  'Insurance',
  'Billing',
  'Consent',
] as const;
type Tab = (typeof tabs)[number];

const calculateAge = (dob: string) => {
  if (!dob) return '';
  const birthDate = new Date(dob);
  const ageDifMs = Date.now() - birthDate.getTime();
  const ageDate = new Date(ageDifMs);
  const years = Math.abs(ageDate.getUTCFullYear() - 1970);
  return `${years} years`;
};

const toForm = (patient: PatientResponse): ProfileForm => ({
  bloodGroup: patient.blood_group ?? '',
  dateOfBirth: patient.date_of_birth.slice(0, 10),
  email: patient.email ?? '',
  firstName: patient.first_name,
  gender: patient.gender,
  lastName: patient.last_name,
  notes: patient.notes ?? '',
  phone: patient.phone ?? '',
  status: patient.status,
});

const nullable = (value: string) => value.trim() || null;

function EmptyRecords({ message }: { message: string }) {
  return <div className="patient-empty-inline">{message}</div>;
}

export function PatientProfilePage() {
  const { search } = useAppLocation();
  const requestedPatientId = getPatientIdFromSearch(search);
  const [patients, setPatients] = useState<PatientResponse[]>([]);
  const [history, setHistory] = useState<PatientHistoryResponse | null>(null);
  const [appointments, setAppointments] = useState<AppointmentResponse[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const list = await patientsApi.list({ limit: 50 });
      setPatients(list.data);
      const patientId = requestedPatientId || list.data[0]?.id;
      if (!patientId) {
        setHistory(null);
        setAppointments([]);
        return;
      }
      const [historyResult, appointmentResult] = await Promise.all([
        patientsApi.history(patientId),
        appointmentsApi.list({ patient_id: patientId, limit: 50, sortBy: 'appointment_date', sortOrder: 'desc' }),
      ]);
      setHistory(historyResult);
      setAppointments(appointmentResult.data);
    } catch (error) {
      setHistory(null);
      setAppointments([]);
      setLoadError(getPatientErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [requestedPatientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patient = history?.patient ?? null;
  const timeline = history?.timeline ?? [];
  const documents = history?.documents ?? [];
  const consents = useMemo(() => documents.filter((document) => document.document_type === 'CONSENT'), [documents]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!patient || !form) return;
    if (!form.firstName.trim() || !form.lastName.trim() || !form.dateOfBirth) {
      setFormError('First name, last name, and date of birth are required.');
      return;
    }
    const payload: Partial<SavePatientPayload> = {
      blood_group: nullable(form.bloodGroup),
      date_of_birth: form.dateOfBirth,
      email: nullable(form.email),
      first_name: form.firstName.trim(),
      gender: form.gender,
      last_name: form.lastName.trim(),
      notes: nullable(form.notes),
      phone: nullable(form.phone),
      status: form.status,
    };
    setSubmitting(true);
    setFormError('');
    try {
      await patientsApi.update(patient.id, payload);
      setEditOpen(false);
      showToast('Patient profile updated successfully.');
      await load();
    } catch (error) {
      setFormError(getPatientErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="um-state-cell">Loading patient profile...</div>;
  if (loadError) return <div className="um-state-cell" role="alert">{loadError}<div><button className="doc-btn mt-4" onClick={() => void load()} type="button">Retry</button></div></div>;
  if (!patient) return <EmptyRecords message="No patient records are available." />;

  return (
    <>
      <div className="appointment-page">
        <section className="appointment-page-header">
          <div className="appointment-page-title">
            <h2>Patient Profile</h2>
            <p>Complete demographic and clinical overview</p>
          </div>
          <div className="appointment-page-actions">
            <label className="sr-only" htmlFor="profile-patient">Switch patient</label>
            <select
              id="profile-patient"
              onChange={(event) => navigate(`/patients/profile?id=${encodeURIComponent(event.target.value)}`)}
              value={patient.id}
            >
              {patients.map((item) => (
                <option key={item.id} value={item.id}>
                  Switch Patient: {patientFullName(item)} • {item.patient_number}
                </option>
              ))}
            </select>
            <button className="doc-btn" onClick={() => navigate('/patients/search')} type="button">
              <i className="ph ph-magnifying-glass" aria-hidden="true" />
              Search Patients
            </button>
          </div>
        </section>

        {/* Hero Banner (Ripped from Image 2) */}
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
                  • {patient.status}
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
            <button className="doc-btn" onClick={() => { setForm(toForm(patient)); setFormError(''); setEditOpen(true); }} type="button">
              <i className="ph ph-pencil-simple" aria-hidden="true" /> Edit Patient
            </button>
            <button className="doc-btn primary" onClick={() => navigate(`/appointments/book?patient_id=${encodeURIComponent(patient.id)}`)} type="button">
              <i className="ph ph-calendar-plus" aria-hidden="true" /> Book Appointment
            </button>
            <button className="doc-btn" onClick={() => window.print()} type="button">
              <i className="ph ph-printer" aria-hidden="true" /> Print Card
            </button>
          </div>
        </section>

        {/* 10 Horizontal Navigation Tabs */}
        <section className="doc-card" style={{ marginTop: '1.25rem', padding: '0.5rem 1rem 0' }}>
          <div className="opd-workspace-tabs" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            {tabs.map((tab) => (
              <button
                className={`opd-workspace-tab ${activeTab === tab ? 'active' : ''}`}
                key={tab}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>
        </section>

        {/* Tab Contents */}
        <section className="doc-card" style={{ marginTop: '1.25rem', overflow: 'hidden', padding: 0 }}>
          {activeTab === 'Overview' ? (
            <div className="profile-6card-grid">
              {/* Card 1: Personal Information */}
              <article className="profile-overview-card">
                <h3><i className="ph ph-user-circle" /> Personal Information</h3>
                <div className="profile-info-grid">
                  <span className="label">Full Name</span>
                  <span className="value">{patientFullName(patient)}</span>
                  <span className="label">Gender / Age</span>
                  <span className="value">{patient.gender}, {calculateAge(patient.date_of_birth)}</span>
                  <span className="label">Date of Birth</span>
                  <span className="value">{formatDate(patient.date_of_birth)}</span>
                  <span className="label">National ID</span>
                  <span className="value">{patient.patient_number}</span>
                  <span className="label">Address</span>
                  <span className="value">{[patient.address.line1, patient.address.city, patient.address.country].filter(Boolean).join(', ') || 'Not recorded'}</span>
                  <span className="label">Preferred Language</span>
                  <span className="value">English</span>
                </div>
              </article>

              {/* Card 2: Emergency Contact */}
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

              {/* Card 3: Current Medications */}
              <article className="profile-overview-card">
                <h3><i className="ph ph-pill" /> Current Medications</h3>
                {timeline.filter((t) => t.title.toLowerCase().includes('prescr') || t.title.toLowerCase().includes('med')).length === 0 ? (
                  <EmptyRecords message="No active medications recorded for this patient." />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {timeline.slice(0, 3).map((item) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
                        <div>
                          <strong>{item.title}</strong>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.description}</div>
                        </div>
                        <span className="doc-status active">• Active</span>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              {/* Card 4: Recent Visits */}
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

              {/* Card 5: Outstanding Bills */}
              <article className="profile-overview-card">
                <h3><i className="ph ph-receipt" /> Outstanding Bills</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Current balance</span>
                    <strong style={{ fontSize: '1.2rem', color: '#0f172a' }}>KES 0</strong>
                  </div>
                  <div>
                    <button className="doc-btn" onClick={() => setActiveTab('Billing')} type="button">
                      View Billing
                    </button>
                  </div>
                </div>
              </article>

              {/* Card 6: Alerts */}
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
          ) : null}

          {activeTab === 'Medical History' ? (
            timeline.length === 0 ? (
              <EmptyRecords message="No medical history events recorded for this patient." />
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr><th>DATE</th><th>EVENT</th><th>DESCRIPTION</th></tr>
                  </thead>
                  <tbody>
                    {timeline.map((event) => (
                      <tr key={event.id}>
                        <td>{formatDateTime(event.occurred_at)}</td>
                        <td><strong>{event.title}</strong></td>
                        <td>{event.description || 'No description recorded'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {activeTab === 'Visits' ? (
            timeline.length === 0 ? (
              <EmptyRecords message="No OPD visit records found for this patient." />
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr><th>DATE</th><th>VISIT NUMBER</th><th>TYPE</th><th>STATUS</th></tr>
                  </thead>
                  <tbody>
                    {timeline.map((event) => (
                      <tr key={event.id}>
                        <td>{formatDate(event.occurred_at)}</td>
                        <td><strong>{event.title}</strong></td>
                        <td>OPD Consultation</td>
                        <td><span className="doc-status active">COMPLETED</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {activeTab === 'Appointments' ? (
            appointments.length === 0 ? (
              <EmptyRecords message="No appointments recorded for this patient." />
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr><th>DATE</th><th>TIME</th><th>DOCTOR</th><th>TYPE</th><th>STATUS</th></tr>
                  </thead>
                  <tbody>
                    {appointments.map((appointment) => (
                      <tr key={appointment.id}>
                        <td>{formatDate(appointment.appointment_date)}</td>
                        <td>{appointment.start_time}</td>
                        <td>{appointment.doctor_name}</td>
                        <td>{appointment.visit_type.replaceAll('_', ' ')}</td>
                        <td><span className="doc-status active">{appointment.status.replaceAll('_', ' ')}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {activeTab === 'Medications' ? (
            <EmptyRecords message="No prescription records found for this patient." />
          ) : null}

          {activeTab === 'Lab Results' ? (
            <EmptyRecords message="No laboratory test results found for this patient." />
          ) : null}

          {activeTab === 'Imaging' ? (
            <EmptyRecords message="No radiology / imaging records found for this patient." />
          ) : null}

          {activeTab === 'Documents' ? (
            documents.length === 0 ? (
              <EmptyRecords message="No uploaded documents found for this patient." />
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr><th>DATE</th><th>TITLE</th><th>FILE</th><th>TYPE</th><th>UPLOADED BY</th></tr>
                  </thead>
                  <tbody>
                    {documents.map((document) => (
                      <tr key={document.id}>
                        <td>{formatDate(document.created_at)}</td>
                        <td><strong>{document.title}</strong></td>
                        <td>{document.file_name}</td>
                        <td>{document.document_type}</td>
                        <td>{document.uploaded_by_name || 'Recorded user'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {activeTab === 'Insurance' ? (
            <EmptyRecords message="No insurance coverage details recorded for this patient." />
          ) : null}

          {activeTab === 'Billing' ? (
            <EmptyRecords message="No billing statements or invoices found for this patient." />
          ) : null}

          {activeTab === 'Consent' ? (
            consents.length === 0 ? (
              <EmptyRecords message="No consent forms found for this patient." />
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr><th>DATE</th><th>CONSENT</th><th>SIGNED BY</th><th>STATUS</th><th>VALID UNTIL</th></tr>
                  </thead>
                  <tbody>
                    {consents.map((consent) => (
                      <tr key={consent.id}>
                        <td>{formatDate(consent.created_at)}</td>
                        <td><strong>{consent.title}</strong></td>
                        <td>{consent.signed_by_name || 'Not recorded'}</td>
                        <td>{consent.consent_status || 'Not recorded'}</td>
                        <td>{consent.valid_until ? formatDate(consent.valid_until) : 'Not recorded'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </section>
      </div>

      <Modal onClose={() => setEditOpen(false)} open={editOpen} size="large" title="Edit Patient">
        {form ? (
          <form className="modal-form patient-form doctor-onboarding-form" onSubmit={saveProfile}>
            {formError ? <div className="form-error-banner" role="alert">{formError}</div> : null}

            <div className="locked-notice-banner">
              <i className="ph ph-lock-key" aria-hidden="true" />
              <span>
                Core identity attributes (Name, Date of Birth, Gender, Blood Group) are locked to preserve clinical record integrity.
              </span>
            </div>

            <section className="doctor-onboarding-section">
              <header>
                <span><i className="ph ph-user" aria-hidden="true" /></span>
                <div>
                  <h3>Identity Information</h3>
                  <p>Immutable patient identification and demographic attributes.</p>
                </div>
              </header>
              <div className="form-grid">
                <div className="form-group locked">
                  <label htmlFor="profile-first">
                    First name <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>
                  </label>
                  <input disabled id="profile-first" readOnly value={form.firstName} />
                </div>
                <div className="form-group locked">
                  <label htmlFor="profile-last">
                    Last name <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>
                  </label>
                  <input disabled id="profile-last" readOnly value={form.lastName} />
                </div>
                <div className="form-group locked">
                  <label htmlFor="profile-dob">
                    Date of birth <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>
                  </label>
                  <input disabled id="profile-dob" readOnly type="date" value={form.dateOfBirth} />
                </div>
                <div className="form-group locked">
                  <label htmlFor="profile-gender">
                    Gender <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>
                  </label>
                  <select disabled id="profile-gender" value={form.gender}>
                    <option value="UNKNOWN">Unknown</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="form-group locked">
                  <label htmlFor="profile-blood">
                    Blood group <span className="locked-field-badge"><i className="ph ph-lock-key" /> Locked</span>
                  </label>
                  <input disabled id="profile-blood" readOnly value={form.bloodGroup || 'Not recorded'} />
                </div>
              </div>
            </section>

            <section className="doctor-onboarding-section">
              <header>
                <span><i className="ph ph-phone" aria-hidden="true" /></span>
                <div>
                  <h3>Contact & Operations</h3>
                  <p>Editable communication details, status, and clinical notes.</p>
                </div>
              </header>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="profile-phone">Phone</label>
                  <input disabled={submitting} id="profile-phone" onChange={(event) => setForm({ ...form, phone: event.target.value })} value={form.phone} />
                </div>
                <div className="form-group">
                  <label htmlFor="profile-email">Email</label>
                  <input disabled={submitting} id="profile-email" onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" value={form.email} />
                </div>
                <div className="form-group">
                  <label htmlFor="profile-status">Status</label>
                  <select disabled={submitting} id="profile-status" onChange={(event) => setForm({ ...form, status: event.target.value as ApiPatientStatus })} value={form.status}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="DECEASED">Deceased</option>
                  </select>
                </div>
                <div className="form-group full-width">
                  <label htmlFor="profile-notes">Registration Notes</label>
                  <textarea disabled={submitting} id="profile-notes" onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} value={form.notes} />
                </div>
              </div>
            </section>

            <div className="modal-actions">
              <button className="secondary-action" disabled={submitting} onClick={() => setEditOpen(false)} type="button">
                Cancel
              </button>
              <button className="primary-action" disabled={submitting} type="submit">
                {submitting ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
      <Toast message={toast} visible={Boolean(toast)} />
    </>
  );
}
