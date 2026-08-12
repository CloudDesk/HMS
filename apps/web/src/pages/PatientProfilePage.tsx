import { useCallback, useEffect, useState, type FormEvent } from 'react';
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
import {
  formatDate,
  formatDateTime,
  getPatientErrorMessage,
  getPatientIdFromSearch,
  patientFullName,
} from './patient-utils';

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
  const patientId = getPatientIdFromSearch(search);
  const [history, setHistory] = useState<PatientHistoryResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(patientId));
  const [loadError, setLoadError] = useState('');
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

  const loadPatient = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setLoadError('');

    try {
      setHistory(await patientsApi.history(patientId));
    } catch (error) {
      setHistory(null);
      setLoadError(getPatientErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void loadPatient();
  }, [loadPatient]);

  if (!patientId) {
    return <NoPatientSelected />;
  }

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
      <div className="um-grid">
        <div className="patient-profile-grid">
          <section className="card patient-summary-card">
            {loading ? (
              <div className="um-state-cell">Loading patient profile...</div>
            ) : loadError ? (
              <div className="um-state-cell">
                {loadError}
                <div>
                  <button className="secondary-action mt-4" onClick={loadPatient} type="button">
                    Retry
                  </button>
                </div>
              </div>
            ) : patient ? (
              <>
                <div className="patient-summary-header">
                  <div>
                    <span className="emp-id">{patient.patient_number}</span>
                    <h2>{patientFullName(patient)}</h2>
                    <p>{patient.phone || 'No phone recorded'} · {patient.email || 'No email recorded'}</p>
                  </div>
                  <div className="patient-summary-actions">
                    <span className={`status-badge ${patient.status === 'ACTIVE' ? 'status-active' : 'status-inactive'}`}>
                      {patient.status}
                    </span>
                    <button className="primary-action" onClick={openEdit} type="button">
                      <i className="ph ph-pencil-simple" aria-hidden="true" /> Edit Profile
                    </button>
                  </div>
                </div>

                <div className="patient-detail-grid">
                  <div>
                    <span>Date of birth</span>
                    <strong>{formatDate(patient.date_of_birth)}</strong>
                  </div>
                  <div>
                    <span>Gender</span>
                    <strong>{patient.gender}</strong>
                  </div>
                  <div>
                    <span>Blood group</span>
                    <strong>{patient.blood_group || '-'}</strong>
                  </div>
                  <div>
                    <span>Registered</span>
                    <strong>{formatDate(patient.created_at)}</strong>
                  </div>
                  <div>
                    <span>Address</span>
                    <strong>{[patient.address.line1, patient.address.city, patient.address.country].filter(Boolean).join(', ') || '-'}</strong>
                  </div>
                  <div>
                    <span>Emergency contact</span>
                    <strong>
                      {patient.emergency_contact.name
                        ? `${patient.emergency_contact.name} · ${patient.emergency_contact.phone || '-'}`
                        : '-'}
                    </strong>
                  </div>
                </div>
              </>
            ) : null}
          </section>

          <section className="card patient-history-card">
            <div className="card-header">
              <h3>Patient History</h3>
              <button
                className="secondary-action"
                disabled={!patient}
                onClick={() => navigate(`/patients/emr?id=${encodeURIComponent(patientId)}`)}
                type="button"
              >
                View EMR Timeline
              </button>
            </div>
            {loading ? (
              <div className="um-state-cell">Loading history...</div>
            ) : history && history.timeline.length > 0 ? (
              <div className="patient-timeline-list">
                {history.timeline.slice(0, 5).map((event) => (
                  <div className="patient-timeline-item" key={event.id}>
                    <span className="timeline-dot" />
                    <div>
                      <strong>{event.title}</strong>
                      <p>{event.description || 'No additional details recorded.'}</p>
                      <span>{formatDateTime(event.occurred_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="patient-empty-inline">No patient history has been recorded yet.</div>
            )}
          </section>

          <section className="card patient-history-card">
            <div className="card-header">
              <h3>Documents</h3>
              <button
                className="secondary-action"
                disabled={!patient}
                onClick={() => navigate(`/patients/documents?id=${encodeURIComponent(patientId)}`)}
                type="button"
              >
                Manage Documents
              </button>
            </div>
            {history && history.documents.length > 0 ? (
              <div className="patient-document-mini-list">
                {history.documents.slice(0, 4).map((document) => (
                  <div key={document.id}>
                    <i className="ph ph-file-text" aria-hidden="true" />
                    <span>{document.title}</span>
                    <strong>{document.document_type}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="patient-empty-inline">No documents linked to this patient.</div>
            )}
          </section>
        </div>
      </div>

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
                <label htmlFor="edit-first-name">First name *</label>
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
                <label htmlFor="edit-last-name">Last name *</label>
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
                <label htmlFor="edit-dob">Date of birth *</label>
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
                <label htmlFor="edit-gender">Gender *</label>
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

