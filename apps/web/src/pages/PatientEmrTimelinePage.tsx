import { useCallback, useEffect, useState } from 'react';
import {
  patientsApi,
  type PatientResponse,
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

const eventIcon = (eventType: PatientTimelineEventResponse['event_type']) => {
  if (eventType === 'REGISTRATION') return 'ph ph-user-plus';
  if (eventType === 'PROFILE_UPDATED') return 'ph ph-pencil-simple';
  if (eventType === 'CONSENT_ADDED') return 'ph ph-signature';
  if (eventType === 'DOCUMENT_DELETED') return 'ph ph-trash';
  return 'ph ph-file-text';
};

function NoPatientSelected() {
  return (
    <div className="um-grid">
      <div className="card patient-empty-panel">
        <i className="ph ph-clock-counter-clockwise" aria-hidden="true" />
        <h3>Select a patient record</h3>
        <p>Open a patient from search to view the EMR timeline.</p>
        <button className="primary-action" onClick={() => navigate('/patients/search')} type="button">
          Search Patients
        </button>
      </div>
    </div>
  );
}

export function PatientEmrTimelinePage() {
  const { search } = useAppLocation();
  const patientId = getPatientIdFromSearch(search);
  const [patient, setPatient] = useState<PatientResponse | null>(null);
  const [timeline, setTimeline] = useState<PatientTimelineEventResponse[]>([]);
  const [loading, setLoading] = useState(Boolean(patientId));
  const [loadError, setLoadError] = useState('');

  const loadTimeline = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setLoadError('');

    try {
      const [patientResponse, timelineResponse] = await Promise.all([
        patientsApi.getById(patientId),
        patientsApi.timeline(patientId),
      ]);
      setPatient(patientResponse);
      setTimeline(timelineResponse);
    } catch (error) {
      setPatient(null);
      setTimeline([]);
      setLoadError(getPatientErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  if (!patientId) {
    return <NoPatientSelected />;
  }

  return (
    <div className="um-grid">
      <section className="card patient-summary-strip">
        <div>
          <span className="emp-id">{patient?.patient_number ?? 'Patient record'}</span>
          <h2>{patient ? patientFullName(patient) : 'EMR Timeline'}</h2>
          {patient && (
            <p>
              {patient.gender} · DOB {formatDate(patient.date_of_birth)} · {patient.status}
            </p>
          )}
        </div>
        <div className="patient-summary-actions">
          <button className="secondary-action" onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(patientId)}`)} type="button">
            Profile
          </button>
          <button className="secondary-action" onClick={() => navigate(`/patients/documents?id=${encodeURIComponent(patientId)}`)} type="button">
            Documents
          </button>
        </div>
      </section>

      <section className="card patient-emr-card">
        <div className="card-header">
          <h3>Chronological EMR Timeline</h3>
          <button className="secondary-action" onClick={loadTimeline} type="button">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="um-state-cell">Loading EMR timeline...</div>
        ) : loadError ? (
          <div className="um-state-cell">
            {loadError}
            <div>
              <button className="secondary-action mt-4" onClick={loadTimeline} type="button">
                Retry
              </button>
            </div>
          </div>
        ) : timeline.length === 0 ? (
          <div className="patient-empty-inline">No EMR events have been recorded for this patient.</div>
        ) : (
          <div className="patient-emr-list">
            {timeline.map((event) => (
              <article className="patient-emr-event" key={event.id}>
                <div className="patient-emr-icon">
                  <i className={eventIcon(event.event_type)} aria-hidden="true" />
                </div>
                <div>
                  <div className="patient-emr-event-header">
                    <strong>{event.title}</strong>
                    <span>{formatDateTime(event.occurred_at)}</span>
                  </div>
                  <p>{event.description || 'No additional details recorded.'}</p>
                  <span className="status-badge status-blue">{event.event_type.replaceAll('_', ' ')}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

