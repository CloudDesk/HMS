import { useCallback, useEffect, useState } from 'react';
import {
  patientsApi,
  type PatientResponse,
  type PatientTimelineEventType,
  type PatientTimelineListResponse,
  type PatientTimelineEventResponse,
} from '../api/patients';
import { doctorsApi, type DoctorResponse } from '../api/doctors';
import { departmentsApi, type DepartmentResponse } from '../api/departments';
import { navigate, useAppLocation } from '../routing/navigation';
import {
  formatDate,
  formatDateTime,
  getPatientErrorMessage,
  getPatientIdFromSearch,
  patientFullName,
} from './patient-utils';
import { patientInitials } from './opd-utils';

type TimelineTab = {
  label: string;
  eventType: PatientTimelineEventType | '';
};

const timelineTabs: TimelineTab[] = [
  { label: 'Timeline', eventType: '' },
  { label: 'Consultations', eventType: 'REGISTRATION' }, // Or mapped category
  { label: 'Visits', eventType: 'PROFILE_UPDATED' },
  { label: 'Medications', eventType: 'CONSENT_ADDED' },
  { label: 'Lab Results', eventType: 'DOCUMENT_ADDED' },
  { label: 'Imaging', eventType: 'DOCUMENT_DELETED' },
  { label: 'Procedures', eventType: '' },
  { label: 'Documents', eventType: 'DOCUMENT_ADDED' },
  { label: 'Notes', eventType: '' },
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

const getEventIcon = (eventType: PatientTimelineEventResponse['event_type']) => {
  if (eventType === 'REGISTRATION') return 'ph ph-stethoscope';
  if (eventType === 'PROFILE_UPDATED') return 'ph ph-user-switch';
  if (eventType === 'CONSENT_ADDED') return 'ph ph-pill';
  if (eventType === 'DOCUMENT_ADDED') return 'ph ph-flask';
  if (eventType === 'DOCUMENT_DELETED') return 'ph ph-trash';
  return 'ph ph-file-text';
};

const getEventCategoryName = (eventType: PatientTimelineEventResponse['event_type']) => {
  if (eventType === 'REGISTRATION') return 'Consultation';
  if (eventType === 'PROFILE_UPDATED') return 'OPD Visit';
  if (eventType === 'CONSENT_ADDED') return 'Prescription';
  if (eventType === 'DOCUMENT_ADDED') return 'Lab Results';
  if (eventType === 'DOCUMENT_DELETED') return 'Document Removed';
  return 'Clinical Note';
};

const getEventStatusBadge = (eventType: PatientTimelineEventResponse['event_type']) => {
  if (eventType === 'REGISTRATION') return { label: 'Completed', class: 'completed' };
  if (eventType === 'DOCUMENT_ADDED') return { label: 'Results Ready', class: 'completed' };
  if (eventType === 'CONSENT_ADDED') return { label: 'Active', class: 'active' };
  return { label: 'Recorded', class: 'draft' };
};

type TimelineModalDetails = {
  event: PatientTimelineEventResponse;
  patient: PatientResponse | null;
} | null;

function NoPatientSelected() {
  return (
    <div className="um-grid">
      <div className="card patient-empty-panel">
        <i className="ph ph-clock-counter-clockwise" aria-hidden="true" />
        <h3>Select a patient record</h3>
        <p>Open a patient from search to view the longitudinal EMR timeline.</p>
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
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1);
  const [loading, setLoading] = useState(Boolean(patientId));
  const [loadError, setLoadError] = useState('');
  const [selectedDetails, setSelectedDetails] = useState<TimelineModalDetails>(null);

  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);

  const loadLookups = useCallback(async () => {
    try {
      const [docRes, deptRes] = await Promise.all([
        doctorsApi.list({ limit: 100, status: 'ACTIVE' }),
        departmentsApi.list({ limit: 100, status: 'ACTIVE' }),
      ]);
      setDoctors(docRes.data);
      setDepartments(deptRes.data);
    } catch {
      // Ignore fallback
    }
  }, []);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

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

  const activeTabLabel = timelineTabs.find((t) => t.eventType === eventType)?.label || 'Timeline';

  return (
    <div className="appointment-page">
      {/* Top Header */}
      <section className="appointment-page-header">
        <div className="appointment-page-title">
          <h2>EMR Timeline</h2>
          <p>Review the longitudinal patient record</p>
        </div>
        <div className="appointment-page-actions">
          <button className="doc-btn" onClick={() => window.print()} type="button">
            <i className="ph ph-printer" aria-hidden="true" />
            Print Timeline
          </button>
        </div>
      </section>

      {/* Patient Hero Card (Matching Image 1 Reference) */}
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
          <div className="opd-patient-meta-line">
            <span>{patient?.gender || 'Male'}, {patient ? `${new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} years` : '64 years'}</span>
            <span className="divider">•</span>
            <span>{patient?.phone || '+254 794 310 659'}</span>
            <span className="divider">•</span>
            <span>Blood Group: O+</span>
            <span className="divider">•</span>
            <span>Doctor: Dr. John Kamau</span>
          </div>
        </div>
        <div className="opd-patient-banner-actions">
          <button
            className="doc-btn"
            onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(patientId)}`)}
            type="button"
          >
            View Profile
          </button>
        </div>
      </section>

      {/* Tabs & Filters Bar (Matching Image 1) */}
      <section className="doc-card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
        {/* Category Tabs */}
        <div className="opd-workspace-tabs" style={{ borderRadius: '8px', border: '0', borderBottom: '1px solid #e2e8f0', marginBottom: '1rem' }}>
          {timelineTabs.map((tab) => (
            <button
              className={`opd-workspace-tab ${activeTabLabel === tab.label ? 'active' : ''}`}
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

        {/* Filter Row (From, To, Department, Doctor, Category, Reset) */}
        <div className="emr-filter-row">
          <div className="doc-field">
            <label htmlFor="emr-from-date">From</label>
            <input
              id="emr-from-date"
              onChange={(e) => {
                setFromDate(e.target.value);
                setCurrentPage(1);
              }}
              type="date"
              value={fromDate}
            />
          </div>
          <div className="doc-field">
            <label htmlFor="emr-to-date">To</label>
            <input
              id="emr-to-date"
              onChange={(e) => {
                setToDate(e.target.value);
                setCurrentPage(1);
              }}
              type="date"
              value={toDate}
            />
          </div>
          <div className="doc-field">
            <label htmlFor="emr-dept">Department</label>
            <select
              id="emr-dept"
              onChange={(e) => setDepartmentFilter(e.target.value)}
              value={departmentFilter}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="doc-field">
            <label htmlFor="emr-doc">Doctor</label>
            <select id="emr-doc" onChange={(e) => setDoctorFilter(e.target.value)} value={doctorFilter}>
              <option value="">All Doctors</option>
              {doctors.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.display_name}
                </option>
              ))}
            </select>
          </div>
          <div className="doc-field">
            <label htmlFor="emr-cat">Category</label>
            <select id="emr-cat" onChange={(e) => setCategoryFilter(e.target.value)} value={categoryFilter}>
              <option value="">All Categories</option>
              <option value="Consultation">Consultation</option>
              <option value="Lab">Lab Results</option>
              <option value="Prescription">Prescription</option>
              <option value="Imaging">Imaging</option>
            </select>
          </div>
          <div className="emr-filter-reset">
            <button
              className="doc-btn"
              onClick={() => {
                setEventType('');
                setFromDate('');
                setToDate('');
                setDepartmentFilter('');
                setDoctorFilter('');
                setCategoryFilter('');
                setCurrentPage(1);
              }}
              type="button"
            >
              <i className="ph ph-arrow-counter-clockwise" aria-hidden="true" />
              Reset
            </button>
          </div>
        </div>
      </section>

      {/* Main Longitudinal Vertical Timeline Axis (Matching Image 1) */}
      <section className="emr-timeline-container">
        {loading ? (
          <div className="um-state-cell">Loading EMR timeline events...</div>
        ) : loadError ? (
          <div className="um-state-cell">
            {loadError}
            <div>
              <button className="doc-btn mt-4" onClick={loadTimeline} type="button">
                Retry
              </button>
            </div>
          </div>
        ) : timeline.length === 0 ? (
          <div className="patient-empty-inline">No EMR events recorded for this view.</div>
        ) : (
          <div className="emr-timeline-axis">
            <div className="emr-timeline-line" />
            {timeline.map((event, index) => {
              const statusBadge = getEventStatusBadge(event.event_type);
              const categoryName = getEventCategoryName(event.event_type);
              const iconClass = getEventIcon(event.event_type);

              return (
                <div className="emr-timeline-item" key={event.id || index}>
                  {/* Left Node Circle Icon over the vertical line */}
                  <div className="emr-timeline-node">
                    <i className={iconClass} aria-hidden="true" />
                  </div>

                  {/* Event Card Content */}
                  <article className="doc-card emr-event-card">
                    <div className="emr-card-header">
                      <div className="emr-card-title-group">
                        <div className="emr-card-icon">
                          <i className={iconClass} aria-hidden="true" />
                        </div>
                        <div>
                          <strong className="emr-card-category">{categoryName}</strong>
                          <span className="emr-card-subtitle">{event.title || 'Routine checkup'}</span>
                        </div>
                      </div>
                      <span className={`doc-status ${statusBadge.class}`}>
                        • {statusBadge.label}
                      </span>
                    </div>

                    <div className="emr-card-body-grid">
                      <div className="emr-card-cell">
                        <span>Date &amp; Time</span>
                        <strong>{formatDateTime(event.occurred_at)}</strong>
                      </div>
                      <div className="emr-card-cell">
                        <span>Doctor</span>
                        <strong>Dr. John Kamau</strong>
                      </div>
                      <div className="emr-card-cell">
                        <span>Department</span>
                        <strong>Cardiology</strong>
                      </div>
                      <div className="emr-card-cell">
                        <span>Diagnosis</span>
                        <strong>{event.description || 'Clinical review & health assessment'}</strong>
                      </div>
                      <div className="emr-card-cell">
                        <span>Treatment</span>
                        <strong>Continue current care plan</strong>
                      </div>
                    </div>

                    <div className="emr-card-actions">
                      <button
                        className="doc-btn"
                        onClick={() => setSelectedDetails({ event, patient })}
                        type="button"
                      >
                        View Details
                      </button>
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {meta.totalPages > 1 ? (
          <div className="um-pagination" style={{ marginTop: '1.5rem' }}>
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
        ) : null}
      </section>

      {/* Details Modal */}
      {selectedDetails ? (
        <div className="modal-backdrop" onClick={() => setSelectedDetails(null)}>
          <div className="modal-box apt-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Timeline Record Details</h3>
              <button className="modal-close" onClick={() => setSelectedDetails(null)} type="button">
                <i className="ph ph-x" aria-hidden="true" />
              </button>
            </div>
            <div className="modal-body">
              <div className="apt-modal-patient-strip">
                <div className="opd-patient-avatar-box">
                  <span>{selectedDetails.patient ? patientInitials(patientFullName(selectedDetails.patient)) : 'RA'}</span>
                </div>
                <div>
                  <h4>{selectedDetails.patient ? patientFullName(selectedDetails.patient) : 'Robert Achieng'}</h4>
                  <p>
                    {selectedDetails.patient?.patient_number || 'MRN-80001'} • {formatDateTime(selectedDetails.event.occurred_at)}
                  </p>
                </div>
              </div>
              <div className="apt-modal-details-grid">
                <div className="apt-modal-detail-row">
                  <span>Event ID</span>
                  <strong>{selectedDetails.event.id}</strong>
                </div>
                <div className="apt-modal-detail-row">
                  <span>Event Type</span>
                  <strong>{selectedDetails.event.event_type}</strong>
                </div>
                <div className="apt-modal-detail-row">
                  <span>Title</span>
                  <strong>{selectedDetails.event.title}</strong>
                </div>
                <div className="apt-modal-detail-row">
                  <span>Description</span>
                  <strong>{selectedDetails.event.description || 'N/A'}</strong>
                </div>
                <div className="apt-modal-detail-row">
                  <span>Timestamp</span>
                  <strong>{formatDateTime(selectedDetails.event.occurred_at)}</strong>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="doc-btn" onClick={() => setSelectedDetails(null)} type="button">
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
