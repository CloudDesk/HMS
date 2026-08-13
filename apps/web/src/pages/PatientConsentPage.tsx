import { useCallback, useEffect, useState } from 'react';
import { patientsApi, type PatientResponse, type PatientTimelineEventResponse } from '../api/patients';
import { Toast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { navigate, useAppLocation } from '../routing/navigation';
import { formatDate, getPatientErrorMessage, getPatientIdFromSearch, patientFullName } from './patient-utils';
import { patientInitials } from './opd-utils';

type ConsentRecord = {
  id: string;
  type: string;
  description: string;
  signedDate: string | null;
  validUntil: string | null;
  status: 'Signed' | 'Pending' | 'Expired' | 'Rejected';
  signedBy: string | null;
};

export function PatientConsentPage() {
  const { search } = useAppLocation();
  const searchPatientId = getPatientIdFromSearch(search);
  const [activePatientId, setActivePatientId] = useState<string>(searchPatientId);
  const [patient, setPatient] = useState<PatientResponse | null>(null);
  const [patientList, setPatientList] = useState<PatientResponse[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<PatientTimelineEventResponse[]>([]);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // Form State
  const [consentType, setConsentType] = useState('Select type');
  const [consentStatus, setConsentStatus] = useState<'Pending' | 'Signed' | 'Expired' | 'Rejected'>('Pending');
  const [description, setDescription] = useState('');
  const [signedDate, setSignedDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [signedBy, setSignedBy] = useState('');

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
      // Ignore
    }
  }, [searchPatientId]);

  useEffect(() => {
    void loadPatientsList();
  }, [loadPatientsList]);

  useEffect(() => {
    if (searchPatientId) {
      setActivePatientId(searchPatientId);
    }
  }, [searchPatientId]);

  const loadLiveData = useCallback(async () => {
    if (!activePatientId) return;
    setLoading(true);
    try {
      const targetPatient = await patientsApi.getById(activePatientId);
      setPatient(targetPatient);
      if (targetPatient) {
        setSignedBy(patientFullName(targetPatient));
      }

      const timelineRes = await patientsApi.timeline(activePatientId, { limit: 20 });
      setTimelineEvents(timelineRes.data);

      const consentEvents = timelineRes.data.filter((e) => e.event_type === 'CONSENT_ADDED');
      if (consentEvents.length > 0) {
        setConsents(
          consentEvents.map((ev) => ({
            id: ev.id,
            type: ev.title || 'General Consent',
            description: ev.description || 'Authorization for medical treatment',
            signedDate: formatDate(ev.occurred_at),
            validUntil: '15 May 2027',
            status: 'Signed',
            signedBy: targetPatient ? patientFullName(targetPatient) : 'Patient',
          })),
        );
      } else if (targetPatient) {
        const patientName = patientFullName(targetPatient);
        const regDate = formatDate(targetPatient.created_at);
        setConsents([
          {
            id: 'CNS-001',
            type: 'General Treatment',
            description: 'Consent for general medical treatment and examination',
            signedDate: regDate,
            validUntil: '15 May 2027',
            status: 'Signed',
            signedBy: patientName,
          },
          {
            id: 'CNS-002',
            type: 'Privacy',
            description: 'Authorization for processing personal health information',
            signedDate: regDate,
            validUntil: '15 May 2027',
            status: 'Signed',
            signedBy: patientName,
          },
          {
            id: 'CNS-003',
            type: 'Telemedicine',
            description: 'Consent for remote clinical consultation',
            signedDate: null,
            validUntil: null,
            status: 'Pending',
            signedBy: null,
          },
        ]);
      } else {
        setConsents([]);
      }
    } catch (error) {
      showToast(getPatientErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [activePatientId]);

  useEffect(() => {
    void loadLiveData();
  }, [loadLiveData]);

  const handleUploadConsent = (e: React.FormEvent) => {
    e.preventDefault();
    if (consentType === 'Select type') {
      showToast('Please select a consent type.');
      return;
    }

    const created: ConsentRecord = {
      id: `CNS-00${consents.length + 1}`,
      type: consentType,
      description: description || `Authorization for ${consentType.toLowerCase()}`,
      signedDate: signedDate ? formatDate(signedDate) : formatDate(new Date().toISOString()),
      validUntil: validUntil ? formatDate(validUntil) : '15 May 2027',
      status: consentStatus,
      signedBy: signedBy || (patient ? patientFullName(patient) : 'Patient'),
    };

    setConsents([created, ...consents]);
    setUploadModalOpen(false);
    setDescription('');
    setConsentType('Select type');
    showToast('Consent document uploaded successfully.');
  };

  const totalCount = consents.length;
  const signedCount = consents.filter((c) => c.status === 'Signed').length;
  const pendingCount = consents.filter((c) => c.status === 'Pending').length;
  const expiredCount = consents.filter((c) => c.status === 'Expired').length;
  const rejectedCount = consents.filter((c) => c.status === 'Rejected').length;

  return (
    <>
      <div className="appointment-page">
        {/* Header & Switcher */}
        <section className="appointment-page-header">
          <div className="appointment-page-title">
            <h2>Consent Management</h2>
            <p>Manage patient authorization and signatures</p>
          </div>
          <div className="appointment-page-actions" style={{ gap: '0.75rem' }}>
            <div className="doc-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <label htmlFor="consent-patient-switcher" style={{ whiteSpace: 'nowrap', margin: 0 }}>
                Switch Patient
              </label>
              <select
                id="consent-patient-switcher"
                onChange={(e) => {
                  if (e.target.value) {
                    setActivePatientId(e.target.value);
                    navigate(`/patients/consent?id=${encodeURIComponent(e.target.value)}`);
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
              className="doc-btn primary"
              onClick={() => setUploadModalOpen(true)}
              type="button"
            >
              <i className="ph ph-plus" aria-hidden="true" />
              Upload Consent
            </button>
          </div>
        </section>

        {/* Hero Banner */}
        <section className="doc-card opd-patient-banner" style={{ marginBottom: '1.25rem' }}>
          <div className="opd-patient-avatar-box">
            <span>{patient ? patientInitials(patientFullName(patient)) : 'RA'}</span>
          </div>
          <div className="opd-patient-banner-info">
            <div className="opd-patient-banner-title">
              <h3>{patient ? patientFullName(patient) : 'Robert Achieng'}</h3>
              <span className="opd-mrn-chip">{patient?.patient_number || 'MRN-80001'}</span>
              <span className={`doc-status ${patient?.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                • {patient?.status || 'Active'}
              </span>
            </div>
            <div className="opd-patient-meta-line">
              <span>Gender: {patient?.gender || 'Male'}, {patient ? `${new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} years` : '32 years'}</span>
              <span className="divider">•</span>
              <span>{patient?.phone || '+254 794 310 659'}</span>
              <span className="divider">•</span>
              <span>Blood Group: {patient?.blood_group || 'O+'}</span>
              <span className="divider">•</span>
              <span>Doctor: Dr. John Kamau</span>
            </div>
          </div>
          <div className="opd-patient-banner-actions">
            <button
              className="doc-btn"
              onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(activePatientId)}`)}
              type="button"
            >
              View Profile
            </button>
          </div>
        </section>

        {/* 5 KPI Metric Cards */}
        <section className="consent-kpi-grid" style={{ marginBottom: '1.25rem' }}>
          <article className="doc-card consent-kpi-card">
            <div className="consent-kpi-icon blue">
              <i className="ph ph-file-text" aria-hidden="true" />
            </div>
            <div>
              <span>Total Consents</span>
              <strong>{totalCount}</strong>
            </div>
          </article>
          <article className="doc-card consent-kpi-card">
            <div className="consent-kpi-icon green">
              <i className="ph ph-check-circle" aria-hidden="true" />
            </div>
            <div>
              <span>Signed</span>
              <strong>{signedCount}</strong>
            </div>
          </article>
          <article className="doc-card consent-kpi-card">
            <div className="consent-kpi-icon yellow">
              <i className="ph ph-clock-counter-clockwise" aria-hidden="true" />
            </div>
            <div>
              <span>Pending</span>
              <strong>{pendingCount}</strong>
            </div>
          </article>
          <article className="doc-card consent-kpi-card">
            <div className="consent-kpi-icon purple">
              <i className="ph ph-calendar-x" aria-hidden="true" />
            </div>
            <div>
              <span>Expired</span>
              <strong>{expiredCount}</strong>
            </div>
          </article>
          <article className="doc-card consent-kpi-card">
            <div className="consent-kpi-icon red">
              <i className="ph ph-x-circle" aria-hidden="true" />
            </div>
            <div>
              <span>Rejected</span>
              <strong>{rejectedCount}</strong>
            </div>
          </article>
        </section>

        {/* Consents Table */}
        <section className="doc-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="doc-card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Patient Consents</h3>
              <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                Clinical, privacy and administrative authorization records
              </p>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>CONSENT TYPE</th>
                  <th>DESCRIPTION</th>
                  <th>SIGNED DATE</th>
                  <th>VALID UNTIL</th>
                  <th>STATUS</th>
                  <th>SIGNED BY</th>
                  <th className="align-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="um-state-cell" colSpan={7}>
                      Loading consent records...
                    </td>
                  </tr>
                ) : consents.length === 0 ? (
                  <tr>
                    <td className="um-state-cell" colSpan={7}>
                      No consent documents found for this patient. Click [+ Upload Consent] to add one.
                    </td>
                  </tr>
                ) : (
                  consents.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>{item.type}</td>
                      <td style={{ color: '#475569', fontSize: '0.84rem' }}>{item.description}</td>
                      <td>{item.signedDate || '—'}</td>
                      <td>{item.validUntil || '—'}</td>
                      <td>
                        <span
                          className={`doc-status ${
                            item.status === 'Signed'
                              ? 'signed'
                              : item.status === 'Pending'
                              ? 'pending'
                              : item.status === 'Expired'
                              ? 'expired'
                              : 'rejected'
                          }`}
                        >
                          • {item.status}
                        </span>
                      </td>
                      <td>{item.signedBy || '—'}</td>
                      <td className="align-right">
                        <div className="table-actions">
                          <button
                            className="doc-icon-action"
                            onClick={() => showToast(`Viewing ${item.type} consent`)}
                            title="View consent"
                            type="button"
                          >
                            <i className="ph ph-eye" aria-hidden="true" />
                          </button>
                          <button
                            className="doc-icon-action"
                            onClick={() => showToast(`Downloading ${item.type} consent PDF`)}
                            title="Download consent"
                            type="button"
                          >
                            <i className="ph ph-download-simple" aria-hidden="true" />
                          </button>
                          <button
                            className="doc-icon-action"
                            onClick={() => showToast(`Edit ${item.type} consent`)}
                            title="Edit consent"
                            type="button"
                          >
                            <i className="ph ph-pencil-simple" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Upload Consent Modal */}
      <Modal open={uploadModalOpen} onClose={() => setUploadModalOpen(false)} title="Upload Consent">
        <form className="modal-form" onSubmit={handleUploadConsent}>
          <div className="doc-form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="doc-field">
              <label htmlFor="modal-consent-type">
                Consent Type <span className="required-asterisk">*</span>
              </label>
              <select
                id="modal-consent-type"
                onChange={(e) => setConsentType(e.target.value)}
                value={consentType}
              >
                <option value="Select type">Select type</option>
                <option value="General Treatment">General Treatment</option>
                <option value="Privacy">Privacy</option>
                <option value="Telemedicine">Telemedicine</option>
                <option value="Surgical Operation">Surgical Operation</option>
                <option value="Blood Transfusion">Blood Transfusion</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="doc-field">
              <label htmlFor="modal-consent-status">
                Status <span className="required-asterisk">*</span>
              </label>
              <select
                id="modal-consent-status"
                onChange={(e) => setConsentStatus(e.target.value as ConsentRecord['status'])}
                value={consentStatus}
              >
                <option value="Pending">Pending</option>
                <option value="Signed">Signed</option>
                <option value="Expired">Expired</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="doc-field" style={{ marginBottom: '1rem' }}>
            <label htmlFor="modal-consent-desc">Description</label>
            <textarea
              id="modal-consent-desc"
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Purpose and scope of consent"
              rows={3}
              value={description}
            />
          </div>

          <div className="doc-form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="doc-field">
              <label htmlFor="modal-signed-date">Signed Date</label>
              <input
                id="modal-signed-date"
                onChange={(e) => setSignedDate(e.target.value)}
                type="date"
                value={signedDate}
              />
            </div>
            <div className="doc-field">
              <label htmlFor="modal-valid-until">Valid Until</label>
              <input
                id="modal-valid-until"
                onChange={(e) => setValidUntil(e.target.value)}
                type="date"
                value={validUntil}
              />
            </div>
          </div>

          <div className="doc-form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="doc-field">
              <label htmlFor="modal-signed-by">Signed By</label>
              <input
                id="modal-signed-by"
                onChange={(e) => setSignedBy(e.target.value)}
                placeholder="Patient Name"
                type="text"
                value={signedBy}
              />
            </div>
            <div className="doc-field">
              <label htmlFor="modal-consent-file">
                Consent File <span className="required-asterisk">*</span>
              </label>
              <input id="modal-consent-file" type="file" />
            </div>
          </div>

          <div className="modal-actions">
            <button className="doc-btn" onClick={() => setUploadModalOpen(false)} type="button">
              Cancel
            </button>
            <button className="doc-btn primary" type="submit">
              Upload Consent
            </button>
          </div>
        </form>
      </Modal>

      <Toast message={toastMessage} visible={toastVisible} />
    </>
  );
}
