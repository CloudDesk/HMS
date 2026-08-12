import { useCallback, useEffect, useState } from 'react';
import {
  patientsApi,
  type PatientDocumentResponse,
  type PatientHistoryResponse,
  type PatientTimelineEventResponse,
} from '../api/patients';
import { navigate, useAppLocation } from '../routing/navigation';
import {
  formatDate,
  formatDateTime,
  getPatientErrorMessage,
  getPatientIdFromSearch,
  patientFullName,
} from './patient-utils';

const eventLabel = (eventType: PatientTimelineEventResponse['event_type']) => eventType.replaceAll('_', ' ');

const documentLabel = (document: PatientDocumentResponse) =>
  `${document.document_type}${document.mime_type ? ` - ${document.mime_type}` : ''}`;

function NoPatientSelected() {
  return (
    <div className="um-grid">
      <div className="card patient-empty-panel">
        <i className="ph ph-clock-counter-clockwise" aria-hidden="true" />
        <h3>Select a patient record</h3>
        <p>Open a patient from search to view their history.</p>
        <button className="primary-action" onClick={() => navigate('/patients/search')} type="button">
          Search Patients
        </button>
      </div>
    </div>
  );
}

export function PatientHistoryPage() {
  const { search } = useAppLocation();
  const patientId = getPatientIdFromSearch(search);
  const [history, setHistory] = useState<PatientHistoryResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(patientId));
  const [loadError, setLoadError] = useState('');

  const loadHistory = useCallback(async () => {
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
    void loadHistory();
  }, [loadHistory]);

  if (!patientId) {
    return <NoPatientSelected />;
  }

  const patient = history?.patient ?? null;
  const consents = history?.documents.filter((document) => document.document_type === 'CONSENT') ?? [];
  const documents = history?.documents.filter((document) => document.document_type !== 'CONSENT') ?? [];

  return (
    <div className="um-grid">
      <section className="card patient-summary-strip">
        <div>
          <span className="emp-id">{patient?.patient_number ?? 'Patient record'}</span>
          <h2>{patient ? patientFullName(patient) : 'Patient History'}</h2>
          {patient && (
            <p>
              {patient.gender} - DOB {formatDate(patient.date_of_birth)} - {patient.status}
            </p>
          )}
        </div>
        <div className="patient-summary-actions">
          <button className="secondary-action" onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(patientId)}`)} type="button">
            Profile
          </button>
          <button className="secondary-action" onClick={() => navigate(`/patients/emr?id=${encodeURIComponent(patientId)}`)} type="button">
            EMR Timeline
          </button>
          <button className="secondary-action" onClick={loadHistory} type="button">
            Refresh
          </button>
        </div>
      </section>

      {loading ? (
        <section className="card patient-history-card">
          <div className="um-state-cell">Loading patient history...</div>
        </section>
      ) : loadError ? (
        <section className="card patient-history-card">
          <div className="um-state-cell">
            {loadError}
            <div>
              <button className="secondary-action mt-4" onClick={loadHistory} type="button">
                Retry
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="patient-history-metrics">
            <div className="card patient-history-metric">
              <i className="ph ph-activity" aria-hidden="true" />
              <span>Timeline Events</span>
              <strong>{history?.timeline.length ?? 0}</strong>
            </div>
            <div className="card patient-history-metric">
              <i className="ph ph-file-text" aria-hidden="true" />
              <span>Documents</span>
              <strong>{documents.length}</strong>
            </div>
            <div className="card patient-history-metric">
              <i className="ph ph-signature" aria-hidden="true" />
              <span>Consents</span>
              <strong>{consents.length}</strong>
            </div>
            <div className="card patient-history-metric">
              <i className="ph ph-stethoscope" aria-hidden="true" />
              <span>OPD Visits</span>
              <strong>{history?.visits.length ?? 0}</strong>
            </div>
          </section>

          <div className="patient-history-grid">
            <section className="card patient-history-card">
              <div className="card-header">
                <div>
                  <h3>OPD Visit History</h3>
                  <p>Visits will appear after the OPD visit workflow is implemented.</p>
                </div>
              </div>
              <div className="patient-empty-inline">No OPD visits have been recorded for this patient yet.</div>
            </section>

            <section className="card patient-history-card">
              <div className="card-header">
                <div>
                  <h3>Recent Timeline</h3>
                  <p>Latest recorded patient events from live patient activity.</p>
                </div>
                <button className="secondary-action" onClick={() => navigate(`/patients/emr?id=${encodeURIComponent(patientId)}`)} type="button">
                  View All
                </button>
              </div>
              {history && history.timeline.length > 0 ? (
                <div className="patient-timeline-list">
                  {history.timeline.map((event) => (
                    <div className="patient-timeline-item" key={event.id}>
                      <span className="timeline-dot" />
                      <div>
                        <strong>{event.title}</strong>
                        <p>{event.description || eventLabel(event.event_type)}</p>
                        <span>{formatDateTime(event.occurred_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="patient-empty-inline">No timeline events have been recorded yet.</div>
              )}
            </section>

            <section className="card patient-history-card">
              <div className="card-header">
                <div>
                  <h3>Documents & Consents</h3>
                  <p>Files linked to this patient record.</p>
                </div>
                <button className="secondary-action" onClick={() => navigate(`/patients/documents?id=${encodeURIComponent(patientId)}`)} type="button">
                  Manage
                </button>
              </div>
              {history && history.documents.length > 0 ? (
                <div className="patient-document-mini-list">
                  {history.documents.slice(0, 6).map((document) => (
                    <div key={document.id}>
                      <i className={document.document_type === 'CONSENT' ? 'ph ph-signature' : 'ph ph-file-text'} aria-hidden="true" />
                      <span>{document.title}</span>
                      <strong>{documentLabel(document)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="patient-empty-inline">No documents or consents are linked to this patient.</div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
