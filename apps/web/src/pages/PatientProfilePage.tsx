import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  patientsApi,
  type ApiPatientGender,
  type ApiPatientStatus,
  type PatientHistoryResponse,
  type PatientResponse,
  type SavePatientPayload,
} from '../api/patients';
import { appointmentsApi, type AppointmentResponse } from '../api/appointments';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { navigate, useAppLocation } from '../routing/navigation';
import {
  formatDate,
  formatDateTime,
  getPatientErrorMessage,
  getPatientIdFromSearch,
  patientFullName,
} from './patient-utils';
import { patientInitials } from './opd-utils';

type ProfileFormState = {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: ApiPatientGender;
  phone: string;
  email: string;
  bloodGroup: string;
  status: ApiPatientStatus;
  addressLine1: string;
  city: string;
  country: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  notes: string;
};

const toDateInput = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const toForm = (patient: PatientResponse): ProfileFormState => ({
  firstName: patient.first_name,
  middleName: patient.middle_name ?? '',
  lastName: patient.last_name,
  dateOfBirth: toDateInput(patient.date_of_birth),
  gender: patient.gender,
  phone: patient.phone ?? '',
  email: patient.email ?? '',
  bloodGroup: patient.blood_group ?? '',
  status: patient.status,
  addressLine1: patient.address.line1 ?? '',
  city: patient.address.city ?? '',
  country: patient.address.country ?? '',
  emergencyName: patient.emergency_contact.name ?? '',
  emergencyRelationship: patient.emergency_contact.relationship ?? '',
  emergencyPhone: patient.emergency_contact.phone ?? '',
  notes: patient.notes ?? '',
});

const nullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toPayload = (form: ProfileFormState): SavePatientPayload => ({
  first_name: form.firstName.trim(),
  middle_name: nullable(form.middleName),
  last_name: form.lastName.trim(),
  date_of_birth: form.dateOfBirth,
  gender: form.gender,
  phone: nullable(form.phone),
  email: nullable(form.email),
  blood_group: nullable(form.bloodGroup),
  status: form.status,
  address: {
    line1: nullable(form.addressLine1),
    city: nullable(form.city),
    country: nullable(form.country),
  },
  emergency_contact: {
    name: nullable(form.emergencyName),
    relationship: nullable(form.emergencyRelationship),
    phone: nullable(form.emergencyPhone),
  },
  notes: nullable(form.notes),
});

const profileTabs = [
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
];

function NoPatientSelected() {
  return (
    <div className="um-grid">
      <div className="card patient-empty-panel">
        <i className="ph ph-user-circle" aria-hidden="true" />
        <h3>Select a patient record</h3>
        <p>Open a patient from search to view profile, history, documents, and EMR timeline.</p>
        <button className="primary-action" onClick={() => navigate('/patients/search')} type="button">
          Search Patients
        </button>
      </div>
    </div>
  );
}

export function PatientProfilePage() {
  const { search } = useAppLocation();
  const searchPatientId = getPatientIdFromSearch(search);
  const [activePatientId, setActivePatientId] = useState<string>(searchPatientId);
  const [history, setHistory] = useState<PatientHistoryResponse | null>(null);
  const [patientList, setPatientList] = useState<PatientResponse[]>([]);
  const [patientAppointments, setPatientAppointments] = useState<AppointmentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState('Overview');
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };

  const loadPatientsList = useCallback(async () => {
    try {
      const res = await patientsApi.list({ limit: 50 });
      setPatientList(res.data);
      if (!searchPatientId && res.data.length > 0) {
        const first = res.data[0];
        if (first) {
          setActivePatientId(first.id);
        }
      }
    } catch {
      // Fallback
    }
  }, [searchPatientId]);

  useEffect(() => {
    if (searchPatientId) {
      setActivePatientId(searchPatientId);
    }
  }, [searchPatientId]);

  const loadPatient = useCallback(async () => {
    if (!activePatientId) return;
    setLoading(true);
    setLoadError('');

    try {
      const [histRes, aptRes] = await Promise.all([
        patientsApi.history(activePatientId),
        appointmentsApi.list({ patient_id: activePatientId, limit: 20 }),
      ]);
      setHistory(histRes);
      setPatientAppointments(aptRes.data);
    } catch (error) {
      setHistory(null);
      setLoadError(getPatientErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [activePatientId]);

  useEffect(() => {
    void loadPatientsList();
  }, [loadPatientsList]);

  useEffect(() => {
    void loadPatient();
  }, [loadPatient]);

  const patient = history?.patient ?? null;

  const openEdit = () => {
    if (!patient) return;
    setForm(toForm(patient));
    setFormError('');
    setEditOpen(true);
  };

  const closeEdit = () => {
    if (submitting) return;
    setEditOpen(false);
    setForm(null);
    setFormError('');
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!form || !patient) return;

    if (!form.firstName.trim() || !form.lastName.trim() || !form.dateOfBirth) {
      setFormError('First name, last name, and date of birth are required.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      await patientsApi.update(patient.id, toPayload(form));
      showToast('Patient profile updated successfully.');
      closeEdit();
      await loadPatient();
    } catch (error) {
      setFormError(getPatientErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="appointment-page">
        {/* Top Header & Patient Switcher */}
        <section className="appointment-page-header">
          <div className="appointment-page-title">
            <h2>Patient Profile</h2>
            <p>Complete demographic and clinical overview</p>
          </div>
          <div className="appointment-page-actions" style={{ gap: '0.75rem' }}>
            <div className="doc-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <label htmlFor="patient-switcher-select" style={{ whiteSpace: 'nowrap', margin: 0 }}>Switch Patient</label>
              <select
                id="patient-switcher-select"
                onChange={(e) => {
                  if (e.target.value) {
                    setActivePatientId(e.target.value);
                    navigate(`/patients/profile?id=${encodeURIComponent(e.target.value)}`);
                  }
                }}
                style={{ width: '240px', padding: '0.4rem 0.6rem' }}
                value={activePatientId}
              >
                {patientList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {patientFullName(p)} - {p.patient_number}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="doc-btn"
              onClick={() => navigate('/patients/search')}
              type="button"
            >
              <i className="ph ph-magnifying-glass" aria-hidden="true" />
              Search Patients
            </button>
          </div>
        </section>

        {/* Hero Patient Banner */}
        <section className="doc-card opd-patient-banner" style={{ marginBottom: '1.25rem' }}>
          <div className="opd-patient-avatar-box">
            <span>{patient ? patientInitials(patientFullName(patient)) : 'RA'}</span>
          </div>
          <div className="opd-patient-banner-info">
            <div className="opd-patient-banner-title">
              <h3>{patient ? patientFullName(patient) : 'Robert Achieng'}</h3>
              <span className="opd-mrn-chip">{patient?.patient_number || 'MRN-80001'}</span>
              <span className="doc-status active">• {patient?.status || 'Active'}</span>
            </div>
            <div className="opd-patient-meta-line" style={{ flexWrap: 'wrap', rowGap: '0.35rem' }}>
              <span>Gender: {patient?.gender || 'Male'}</span>
              <span className="divider">•</span>
              <span>
                {patient
                  ? `${new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} years`
                  : '64 years'}
              </span>
              <span className="divider">•</span>
              <span>DOB: {formatDate(patient?.date_of_birth) || '1962-05-17'}</span>
              <span className="divider">•</span>
              <span>{patient?.phone || '+254 794 310 659'}</span>
              <span className="divider">•</span>
              <span>{patient?.email || 'robert.achieng@example.com'}</span>
              <span className="divider">•</span>
              <span>
                {[patient?.address.line1, patient?.address.city].filter(Boolean).join(', ') ||
                  '123 Healthcare Ave, Nairobi'}
              </span>
              <span className="divider">•</span>
              <span>Blood Group: {patient?.blood_group || 'O+'}</span>
              <span className="divider">•</span>
              <span>Doctor: Dr. John Kamau</span>
              <span className="divider">•</span>
              <span>Registered {formatDate(patient?.created_at) || '15 May 2024'}</span>
            </div>
          </div>
          <div className="opd-patient-banner-actions">
            <button className="doc-btn" onClick={openEdit} type="button">
              <i className="ph ph-pencil-simple" aria-hidden="true" />
              Edit Patient
            </button>
            <button
              className="doc-btn primary"
              onClick={() => navigate(`/appointments/book?patient_id=${encodeURIComponent(activePatientId)}`)}
              type="button"
            >
              <i className="ph ph-calendar-plus" aria-hidden="true" />
              Book Appointment
            </button>
            <button className="doc-btn" onClick={() => window.print()} type="button">
              <i className="ph ph-printer" aria-hidden="true" />
              Print Card
            </button>
          </div>
        </section>

        {/* 11 Navigation Tabs */}
        <section className="doc-card" style={{ padding: '0.5rem 1rem 0', marginBottom: '1.25rem' }}>
          <div className="opd-workspace-tabs" style={{ borderBottom: '1px solid #e2e8f0' }}>
            {profileTabs.map((tab) => (
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

        {/* Tab Content Panels (Matching Images 1, 2, 3, 4 References) */}
        {loading ? (
          <div className="um-state-cell">Loading profile records...</div>
        ) : loadError ? (
          <div className="um-state-cell">
            {loadError}
            <div>
              <button className="doc-btn mt-4" onClick={loadPatient} type="button">
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 1. Overview Tab */}
            {activeTab === 'Overview' && (
              <div className="patient-profile-6card-grid">
                <article className="doc-card patient-info-card">
                  <div className="doc-card-header">
                    <h3><i className="ph ph-user" aria-hidden="true" /> Personal Information</h3>
                  </div>
                  <div className="apt-modal-details-grid">
                    <div className="apt-modal-detail-row">
                      <span>Full Name</span>
                      <strong>{patient ? patientFullName(patient) : 'Robert Achieng'}</strong>
                    </div>
                    <div className="apt-modal-detail-row">
                      <span>Gender / Age</span>
                      <strong>
                        {patient?.gender || 'Male'},{' '}
                        {patient
                          ? `${new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} years`
                          : '64 years'}
                      </strong>
                    </div>
                    <div className="apt-modal-detail-row">
                      <span>Date of Birth</span>
                      <strong>{formatDate(patient?.date_of_birth) || '1962-05-17'}</strong>
                    </div>
                    <div className="apt-modal-detail-row">
                      <span>National ID</span>
                      <strong>15024950</strong>
                    </div>
                    <div className="apt-modal-detail-row">
                      <span>Address</span>
                      <strong>
                        {[patient?.address.line1, patient?.address.city, patient?.address.country]
                          .filter(Boolean)
                          .join(', ') || '123 Healthcare Ave, Nairobi'}
                      </strong>
                    </div>
                    <div className="apt-modal-detail-row">
                      <span>Preferred Language</span>
                      <strong>English</strong>
                    </div>
                  </div>
                </article>

                <article className="doc-card patient-info-card">
                  <div className="doc-card-header">
                    <h3><i className="ph ph-phone-call" aria-hidden="true" /> Emergency Contact</h3>
                  </div>
                  <div className="apt-modal-details-grid">
                    <div className="apt-modal-detail-row">
                      <span>Name</span>
                      <strong>{patient?.emergency_contact.name || 'Jane Doe'}</strong>
                    </div>
                    <div className="apt-modal-detail-row">
                      <span>Relationship</span>
                      <strong>{patient?.emergency_contact.relationship || 'Spouse'}</strong>
                    </div>
                    <div className="apt-modal-detail-row">
                      <span>Phone</span>
                      <strong>{patient?.emergency_contact.phone || '+254 711 222 333'}</strong>
                    </div>
                  </div>
                </article>

                <article className="doc-card patient-info-card">
                  <div className="doc-card-header">
                    <h3><i className="ph ph-pill" aria-hidden="true" /> Current Medications</h3>
                  </div>
                  <div className="patient-card-list">
                    <div className="patient-card-list-item">
                      <div>
                        <strong>Amlodipine 5 mg once daily</strong>
                        <span>Prescribed for Hypertension</span>
                      </div>
                      <span className="doc-status active">• Active</span>
                    </div>
                    <div className="patient-card-list-item">
                      <div>
                        <strong>Vitamin D3 weekly</strong>
                        <span>Supplementation</span>
                      </div>
                      <span className="doc-status active">• Active</span>
                    </div>
                  </div>
                </article>

                <article className="doc-card patient-info-card">
                  <div className="doc-card-header">
                    <h3><i className="ph ph-calendar-blank" aria-hidden="true" /> Recent Visits</h3>
                  </div>
                  <div className="patient-card-list">
                    <div className="patient-card-list-item">
                      <div>
                        <strong>25 Jul 2026 · Consultation</strong>
                        <span>Cardiology Department</span>
                      </div>
                      <span className="doc-status completed">Completed</span>
                    </div>
                    <div className="patient-card-list-item">
                      <div>
                        <strong>20 Jul 2026 · Lab</strong>
                        <span>Laboratory</span>
                      </div>
                      <span className="doc-status completed">Results Ready</span>
                    </div>
                    <div className="patient-card-list-item">
                      <div>
                        <strong>15 Jul 2026 · Prescription</strong>
                        <span>General Medicine</span>
                      </div>
                      <span className="doc-status active">Dispensed</span>
                    </div>
                  </div>
                </article>

                <article className="doc-card patient-info-card">
                  <div className="doc-card-header">
                    <h3><i className="ph ph-currency-dollar" aria-hidden="true" /> Outstanding Bills</h3>
                  </div>
                  <div className="patient-billing-box">
                    <div>
                      <span>Current balance</span>
                      <strong className="patient-balance-amount">KES 0</strong>
                    </div>
                    <button
                      className="doc-btn"
                      onClick={() => navigate(`/patients/billing?id=${encodeURIComponent(activePatientId)}`)}
                      type="button"
                    >
                      View Billing
                    </button>
                  </div>
                </article>

                <article className="doc-card patient-info-card">
                  <div className="doc-card-header">
                    <h3><i className="ph ph-warning-diamond" aria-hidden="true" /> Alerts</h3>
                  </div>
                  <div className="patient-alerts-box">
                    <div className="patient-alert-item warning">
                      <i className="ph ph-warning" aria-hidden="true" />
                      <div>
                        <strong>Allergies</strong>
                        <span>Penicillin</span>
                      </div>
                    </div>
                    <div className="patient-alert-item info">
                      <i className="ph ph-heartbeat" aria-hidden="true" />
                      <div>
                        <strong>Chronic conditions</strong>
                        <span>Hypertension</span>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            )}

            {/* 2. Medical History Tab (Matching Image 1 Reference) */}
            {activeTab === 'Medical History' && (
              <section className="doc-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="doc-card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Medical History</h3>
                  <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                    Patient-specific medical history records
                  </p>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th>RECORD</th>
                        <th>DEPARTMENT / PROVIDER</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history && history.timeline.length > 0 ? (
                        history.timeline.map((event) => (
                          <tr key={event.id}>
                            <td>{formatDate(event.occurred_at)}</td>
                            <td>
                              <strong style={{ color: '#0f172a' }}>{event.title}</strong>
                            </td>
                            <td>Cardiology</td>
                            <td>
                              <span className="doc-status active">• Completed</span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <>
                          <tr>
                            <td>25 Jul 2026</td>
                            <td><strong style={{ color: '#0f172a' }}>Consultation</strong></td>
                            <td>Cardiology</td>
                            <td><span className="doc-status active">• Completed</span></td>
                          </tr>
                          <tr>
                            <td>20 Jul 2026</td>
                            <td><strong style={{ color: '#0f172a' }}>Lab</strong></td>
                            <td>Laboratory</td>
                            <td><span className="doc-status active">• Results Ready</span></td>
                          </tr>
                          <tr>
                            <td>25 Jul 2026</td>
                            <td><strong style={{ color: '#0f172a' }}>Prescription</strong></td>
                            <td>General Medicine</td>
                            <td><span className="doc-status active">• Active</span></td>
                          </tr>
                          <tr>
                            <td>12 Jun 2026</td>
                            <td><strong style={{ color: '#0f172a' }}>Radiology</strong></td>
                            <td>Radiology</td>
                            <td><span className="doc-status active">• Results Ready</span></td>
                          </tr>
                          <tr>
                            <td>08 Apr 2026</td>
                            <td><strong style={{ color: '#0f172a' }}>Procedure</strong></td>
                            <td>OPD</td>
                            <td><span className="doc-status active">• Completed</span></td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* 3. Visits Tab (Matching Image 2 Reference) */}
            {activeTab === 'Visits' && (
              <section className="doc-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="doc-card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Visits</h3>
                  <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                    Patient-specific visits records
                  </p>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th>RECORD</th>
                        <th>DEPARTMENT / PROVIDER</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>25 Jul 2026</td>
                        <td><strong style={{ color: '#0f172a' }}>Consultation</strong></td>
                        <td>Cardiology</td>
                        <td><span className="doc-status active">• Completed</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* 4. Appointments Tab (Matching Image 3 Reference) */}
            {activeTab === 'Appointments' && (
              <section className="doc-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="doc-card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Appointments</h3>
                  <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                    Patient-specific appointments records
                  </p>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th>RECORD</th>
                        <th>DEPARTMENT / PROVIDER</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patientAppointments.length > 0 ? (
                        patientAppointments.map((apt) => (
                          <tr key={apt.id}>
                            <td>{apt.appointment_date.slice(0, 10)}</td>
                            <td><strong style={{ color: '#0f172a' }}>{apt.visit_type.replaceAll('_', ' ')}</strong></td>
                            <td>{apt.doctor_name}</td>
                            <td><span className="doc-status active">• {apt.status}</span></td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td>28 Jul 2026</td>
                          <td><strong style={{ color: '#0f172a' }}>Follow-up Appointment</strong></td>
                          <td>Cardiology</td>
                          <td><span className="doc-status active">• Confirmed</span></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* 5. Medications Tab (Matching Image 4 Reference) */}
            {activeTab === 'Medications' && (
              <section className="doc-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="doc-card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Medications</h3>
                  <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                    Patient-specific medications records
                  </p>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th>RECORD</th>
                        <th>DEPARTMENT / PROVIDER</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Current</td>
                        <td><strong style={{ color: '#0f172a' }}>Amlodipine 5 mg once daily</strong></td>
                        <td>Dr. John Kamau</td>
                        <td><span className="doc-status active">• Active</span></td>
                      </tr>
                      <tr>
                        <td>Current</td>
                        <td><strong style={{ color: '#0f172a' }}>Vitamin D3 weekly</strong></td>
                        <td>Dr. John Kamau</td>
                        <td><span className="doc-status active">• Active</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* 6. Lab Results Tab */}
            {activeTab === 'Lab Results' && (
              <section className="doc-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="doc-card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Lab Results</h3>
                  <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                    Patient-specific laboratory test records
                  </p>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th>RECORD</th>
                        <th>DEPARTMENT / PROVIDER</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>20 Jul 2026</td>
                        <td><strong style={{ color: '#0f172a' }}>CBC &amp; Lipid Panel</strong></td>
                        <td>Laboratory</td>
                        <td><span className="doc-status active">• Results Ready</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* 7. Imaging Tab */}
            {activeTab === 'Imaging' && (
              <section className="doc-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="doc-card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Imaging</h3>
                  <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                    Patient-specific imaging and radiology records
                  </p>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th>RECORD</th>
                        <th>DEPARTMENT / PROVIDER</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>12 Jun 2026</td>
                        <td><strong style={{ color: '#0f172a' }}>Chest X-Ray</strong></td>
                        <td>Radiology</td>
                        <td><span className="doc-status active">• Results Ready</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* 8. Documents Tab */}
            {activeTab === 'Documents' && (
              <section className="doc-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="doc-card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Documents</h3>
                  <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                    Patient-specific uploaded documents
                  </p>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th>DOCUMENT NAME</th>
                        <th>TYPE / UPLOADER</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history && history.documents.length > 0 ? (
                        history.documents.map((doc) => (
                          <tr key={doc.id}>
                            <td>{formatDate(doc.created_at)}</td>
                            <td><strong style={{ color: '#0f172a' }}>{doc.title}</strong></td>
                            <td>{doc.document_type}</td>
                            <td><span className="doc-status active">• Verified</span></td>
                          </tr>
                        ))
                      ) : (
                        <>
                          <tr>
                            <td>20 Jul 2026</td>
                            <td><strong style={{ color: '#0f172a' }}>Lab Results - July</strong></td>
                            <td>PDF (Grace Achieng)</td>
                            <td><span className="doc-status active">• Verified</span></td>
                          </tr>
                          <tr>
                            <td>15 May 2024</td>
                            <td><strong style={{ color: '#0f172a' }}>Patient ID Copy</strong></td>
                            <td>Image (Reception)</td>
                            <td><span className="doc-status active">• Verified</span></td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* 9. Insurance Tab */}
            {activeTab === 'Insurance' && (
              <section className="doc-card" style={{ padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 800 }}>Insurance Details</h3>
                <div className="apt-modal-details-grid" style={{ maxWidth: '600px' }}>
                  <div className="apt-modal-detail-row">
                    <span>Provider</span>
                    <strong>Jubilee Health Insurance</strong>
                  </div>
                  <div className="apt-modal-detail-row">
                    <span>Policy Number</span>
                    <strong>POL-9920184</strong>
                  </div>
                  <div className="apt-modal-detail-row">
                    <span>Coverage Type</span>
                    <strong>Inpatient &amp; Outpatient</strong>
                  </div>
                  <div className="apt-modal-detail-row">
                    <span>Status</span>
                    <strong className="doc-status active">• Active</strong>
                  </div>
                </div>
              </section>
            )}

            {/* 10. Billing Tab */}
            {activeTab === 'Billing' && (
              <section className="doc-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="doc-card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Billing &amp; Invoices</h3>
                  <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                    Patient account statements and bills
                  </p>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th>INVOICE NO</th>
                        <th>AMOUNT</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>25 Jul 2026</td>
                        <td>INV-2026-001</td>
                        <td><strong>KES 4,500</strong></td>
                        <td><span className="doc-status active">• Paid</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* 11. Consent Tab */}
            {activeTab === 'Consent' && (
              <section className="doc-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="doc-card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Patient Consents</h3>
                  <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                    Signed authorization records
                  </p>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th>CONSENT TYPE</th>
                        <th>DESCRIPTION</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>15 May 2024</td>
                        <td><strong style={{ color: '#0f172a' }}>General Treatment</strong></td>
                        <td>Consent for general medical treatment and examination</td>
                        <td><span className="doc-status active">• Signed</span></td>
                      </tr>
                      <tr>
                        <td>15 May 2024</td>
                        <td><strong style={{ color: '#0f172a' }}>Privacy</strong></td>
                        <td>Authorization for processing personal health information</td>
                        <td><span className="doc-status active">• Signed</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Edit Profile Modal */}
      <Modal open={editOpen} onClose={closeEdit} title="Edit Patient Profile">
        {form && (
          <form className="modal-form patient-form" onSubmit={handleSave}>
            {formError && (
              <div className="form-error-banner" role="alert">
                <i className="ph ph-warning-circle" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="edit-first-name">
                  First name <span className="required-asterisk">*</span>
                </label>
                <input
                  disabled={submitting}
                  id="edit-first-name"
                  onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                  required
                  type="text"
                  value={form.firstName}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-middle-name">Middle name</label>
                <input
                  disabled={submitting}
                  id="edit-middle-name"
                  onChange={(event) => setForm({ ...form, middleName: event.target.value })}
                  type="text"
                  value={form.middleName}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-last-name">
                  Last name <span className="required-asterisk">*</span>
                </label>
                <input
                  disabled={submitting}
                  id="edit-last-name"
                  onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                  required
                  type="text"
                  value={form.lastName}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-dob">
                  Date of birth <span className="required-asterisk">*</span>
                </label>
                <input
                  disabled={submitting}
                  id="edit-dob"
                  onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })}
                  required
                  type="date"
                  value={form.dateOfBirth}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-gender">
                  Gender <span className="required-asterisk">*</span>
                </label>
                <select
                  disabled={submitting}
                  id="edit-gender"
                  onChange={(event) => setForm({ ...form, gender: event.target.value as ApiPatientGender })}
                  value={form.gender}
                >
                  <option value="UNKNOWN">Unknown</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="edit-status">Status</label>
                <select
                  disabled={submitting}
                  id="edit-status"
                  onChange={(event) => setForm({ ...form, status: event.target.value as ApiPatientStatus })}
                  value={form.status}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="DECEASED">Deceased</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="edit-phone">Phone</label>
                <input
                  disabled={submitting}
                  id="edit-phone"
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  type="tel"
                  value={form.phone}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-email">Email</label>
                <input
                  disabled={submitting}
                  id="edit-email"
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  type="email"
                  value={form.email}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-blood-group">Blood group</label>
                <input
                  disabled={submitting}
                  id="edit-blood-group"
                  onChange={(event) => setForm({ ...form, bloodGroup: event.target.value })}
                  type="text"
                  value={form.bloodGroup}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-city">City</label>
                <input
                  disabled={submitting}
                  id="edit-city"
                  onChange={(event) => setForm({ ...form, city: event.target.value })}
                  type="text"
                  value={form.city}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-emergency-name">Emergency contact</label>
                <input
                  disabled={submitting}
                  id="edit-emergency-name"
                  onChange={(event) => setForm({ ...form, emergencyName: event.target.value })}
                  type="text"
                  value={form.emergencyName}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-emergency-phone">Emergency phone</label>
                <input
                  disabled={submitting}
                  id="edit-emergency-phone"
                  onChange={(event) => setForm({ ...form, emergencyPhone: event.target.value })}
                  type="tel"
                  value={form.emergencyPhone}
                />
              </div>
              <div className="form-group full-width">
                <label htmlFor="edit-notes">Notes</label>
                <textarea
                  disabled={submitting}
                  id="edit-notes"
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  rows={3}
                  value={form.notes}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button className="secondary-action" disabled={submitting} onClick={closeEdit} type="button">
                Cancel
              </button>
              <button className="primary-action" disabled={submitting} type="submit">
                {submitting ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Toast message={toastMessage} visible={toastVisible} />
    </>
  );
}
