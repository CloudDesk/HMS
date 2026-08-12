import { useCallback, useEffect, useState } from 'react';
import {
  patientsApi,
  type PatientResponse,
  type PatientTimelineEventType,
  type PatientTimelineListResponse,
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

type TimelineTab = {
  label: string;
  eventType: PatientTimelineEventType | '';
};

const timelineTabs: TimelineTab[] = [
  { label: 'Timeline', eventType: '' },
  { label: 'Registration', eventType: 'REGISTRATION' },
  { label: 'Profile Updates', eventType: 'PROFILE_UPDATED' },
  { label: 'Documents', eventType: 'DOCUMENT_ADDED' },
  { label: 'Consents', eventType: 'CONSENT_ADDED' },
  { label: 'Deleted Documents', eventType: 'DOCUMENT_DELETED' },
];

const buildTimelineUrl = (
  patientId: string,
  eventType: PatientTimelineEventType | '',
  fromDate: string,
  toDate: string,
  page: number,
) => {
  const params = new URLSearchParams({ id: patientId });
  if (eventType) params.set('event_type', eventType);
  if (fromDate) params.set('from', fromDate);
  if (toDate) params.set('to', toDate);
  if (page > 1) params.set('page', String(page));

  return `/patients/emr?${params.toString()}`;
};

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
  const searchParams = new URLSearchParams(search);
  const patientId = getPatientIdFromSearch(search);
  const [patient, setPatient] = useState<PatientResponse | null>(null);
  const [timeline, setTimeline] = useState<PatientTimelineEventResponse[]>([]);
  const [meta, setMeta] = useState<PatientTimelineListResponse['meta']>({
    limit: 10,
    page: 1,
    total: 0,
    totalPages: 1,
  });
  const [eventType, setEventType] = useState<PatientTimelineEventType | ''>(
    (searchParams.get('event_type') as PatientTimelineEventType | null) ?? '',
  );
  const [fromDate, setFromDate] = useState(searchParams.get('from') ?? '');
  const [toDate, setToDate] = useState(searchParams.get('to') ?? '');
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1);
  const [loading, setLoading] = useState(Boolean(patientId));
  const [loadError, setLoadError] = useState('');

  const loadTimeline = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setLoadError('');

    try {
      const [patientResponse, timelineResponse] = await Promise.all([
        patientsApi.getById(patientId),
        patientsApi.timeline(patientId, {
          event_type: eventType || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
          page: currentPage,
          limit: 10,
        }),
      ]);
      setPatient(patientResponse);
      setTimeline(timelineResponse.data);
      setMeta(timelineResponse.meta);
    } catch (error) {
      setPatient(null);
      setTimeline([]);
      setMeta({ limit: 10, page: currentPage, total: 0, totalPages: 1 });
      setLoadError(getPatientErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [currentPage, eventType, fromDate, patientId, toDate]);

  useEffect(() => {
    if (!patientId) return;
    const nextUrl = buildTimelineUrl(patientId, eventType, fromDate, toDate, currentPage);
    if (window.location.pathname + window.location.search !== nextUrl) {
      navigate(nextUrl, { replace: true });
    }
  }, [currentPage, eventType, fromDate, patientId, toDate]);

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
          <button className="secondary-action" onClick={() => navigate(`/patients/history?id=${encodeURIComponent(patientId)}`)} type="button">
            History
          </button>
          <button className="secondary-action" onClick={() => navigate(`/patients/documents?id=${encodeURIComponent(patientId)}`)} type="button">
            Documents
          </button>
        </div>
      </section>

      <section className="card patient-emr-card">
        <div className="card-header">
          <div>
            <h3>Chronological EMR Timeline</h3>
            <p>Registration, profile, document, and consent events from the live patient record.</p>
          </div>
          <button className="secondary-action" onClick={() => void loadTimeline()} type="button">
            <i className="ph ph-arrow-clockwise" aria-hidden="true" />
            Refresh
          </button>
        </div>

        <div className="patient-tabs">
          {timelineTabs.map((tab) => (
            <button
              className={`patient-tab ${eventType === tab.eventType ? 'active' : ''}`}
              key={tab.label}
              onClick={() => {
                setEventType(tab.eventType);
                setCurrentPage(1);
              }}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="patient-emr-toolbar">
          <div className="doc-field">
            <label htmlFor="emr-from">From</label>
            <input
              id="emr-from"
              onChange={(event) => {
                setFromDate(event.target.value);
                setCurrentPage(1);
              }}
              type="date"
              value={fromDate}
            />
          </div>
          <div className="doc-field">
            <label htmlFor="emr-to">To</label>
            <input
              id="emr-to"
              onChange={(event) => {
                setToDate(event.target.value);
                setCurrentPage(1);
              }}
              type="date"
              value={toDate}
            />
          </div>
          {(eventType || fromDate || toDate) && (
            <button
              className="secondary-action"
              onClick={() => {
                setEventType('');
                setFromDate('');
                setToDate('');
                setCurrentPage(1);
              }}
              type="button"
            >
              Reset
            </button>
          )}
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
          <div className="patient-empty-inline">No EMR events match this view.</div>
        ) : (
          <>
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
                    <div className="patient-emr-meta">
                      <span className="status-badge status-blue">{event.event_type.replaceAll('_', ' ')}</span>
                      <span>Event ID: {event.id}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="um-pagination">
              <span>
                Showing {timeline.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1}-
                {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} events
              </span>
              <div className="um-page-controls">
                <button
                  className="pg-btn"
                  disabled={meta.page <= 1 || loading}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  type="button"
                >
                  <i className="ph ph-caret-left" aria-hidden="true" />
                </button>
                <button className="pg-btn active" disabled type="button">
                  {meta.page}
                </button>
                <button
                  className="pg-btn"
                  disabled={meta.page >= meta.totalPages || loading}
                  onClick={() => setCurrentPage((page) => page + 1)}
                  type="button"
                >
                  <i className="ph ph-caret-right" aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

