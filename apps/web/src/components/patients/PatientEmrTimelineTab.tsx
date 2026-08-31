import { useState, type Dispatch, type SetStateAction } from 'react';
import type { PatientTimelineEventResponse } from '../../api/patients';
import { formatDateTime } from '../../pages/patient-utils';
import { MedicalLoader } from '../ui/MedicalLoader';

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

type PatientEmrTimelineTabProps = {
  loading: boolean;
  loadError: string;
  timeline: PatientTimelineEventResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  filters: { from: string; to: string };
  setFilters: Dispatch<SetStateAction<{ from: string; to: string }>>;
  currentPage: number;
  setCurrentPage: (value: number) => void;
};

export function PatientEmrTimelineTab({ loading, loadError, timeline, meta, filters, setFilters, currentPage, setCurrentPage }: PatientEmrTimelineTabProps) {
  const [selectedDetails, setSelectedDetails] = useState<PatientTimelineEventResponse | null>(null);

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div className="doc-field" style={{ margin: 0 }}>
          <label htmlFor="emr-tab-from">From</label>
          <input
            id="emr-tab-from"
            max={filters.to || undefined}
            onChange={(event) => {
              setFilters((previous) => ({ ...previous, from: event.target.value }));
              setCurrentPage(1);
            }}
            type="date"
            value={filters.from}
          />
        </div>
        <div className="doc-field" style={{ margin: 0 }}>
          <label htmlFor="emr-tab-to">To</label>
          <input
            id="emr-tab-to"
            min={filters.from || undefined}
            onChange={(event) => {
              setFilters((previous) => ({ ...previous, to: event.target.value }));
              setCurrentPage(1);
            }}
            type="date"
            value={filters.to}
          />
        </div>
        <button className="doc-btn" onClick={() => { setFilters({ from: '', to: '' }); setCurrentPage(1); }} type="button">
          <i className="ph ph-arrow-counter-clockwise" aria-hidden="true" /> Reset
        </button>
        <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: '0.83rem', alignSelf: 'center' }}>
          {loading ? 'Loading…' : `${meta.total} events`}
        </span>
      </div>

      {loading ? (
        <div style={{ padding: '2rem 1rem' }}>
          <MedicalLoader text="Loading EMR timeline..." subtext="Retrieving chronological patient clinical events" />
        </div>
      ) : loadError ? (
        <div className="um-state-cell" role="alert">{loadError}</div>
      ) : timeline.length === 0 ? (
        <div className="patient-empty-inline">No EMR events recorded for this patient.</div>
      ) : (
        <div className="emr-timeline-axis">
          <div className="emr-timeline-line" />
          {timeline.map((event, index) => {
            const statusBadge = getEventStatusBadge(event.event_type);
            const categoryName = getEventCategoryName(event.event_type);
            const iconClass = getEventIcon(event.event_type);
            return (
              <div className="emr-timeline-item" key={event.id || index}>
                <div className="emr-timeline-node"><i className={iconClass} aria-hidden="true" /></div>
                <article className="doc-card emr-event-card">
                  <div className="emr-card-header">
                    <div className="emr-card-title-group">
                      <div className="emr-card-icon"><i className={iconClass} aria-hidden="true" /></div>
                      <div>
                        <strong className="emr-card-category">{categoryName}</strong>
                        <span className="emr-card-subtitle">{event.title || 'Clinical event'}</span>
                      </div>
                    </div>
                    <span className={`doc-status ${statusBadge.class}`}>{statusBadge.label}</span>
                  </div>
                  <div className="emr-card-body-grid">
                    <div className="emr-card-cell"><span>Date &amp; Time</span><strong>{formatDateTime(event.occurred_at)}</strong></div>
                    <div className="emr-card-cell"><span>Recorded by</span><strong>{event.created_by_name || event.created_by || 'System'}</strong></div>
                    <div className="emr-card-cell"><span>Description</span><strong>{event.description || 'No description recorded'}</strong></div>
                  </div>
                  <div className="emr-card-actions">
                    <button className="doc-btn" onClick={() => setSelectedDetails(event)} type="button">View Details</button>
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      )}

      {meta.totalPages > 1 ? (
        <div className="um-pagination" style={{ marginTop: '1.5rem' }}>
          <span>
            Showing {timeline.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total} events
          </span>
          <div className="um-page-controls">
            <button className="pg-btn" disabled={meta.page <= 1 || loading} onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} type="button">
              <i className="ph ph-caret-left" aria-hidden="true" />
            </button>
            <button className="pg-btn active" disabled type="button">{meta.page}</button>
            <button className="pg-btn" disabled={meta.page >= meta.totalPages || loading} onClick={() => setCurrentPage(currentPage + 1)} type="button">
              <i className="ph ph-caret-right" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      {selectedDetails ? (
        <div className="modal-backdrop" onClick={() => setSelectedDetails(null)}>
          <div className="modal-box apt-details-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Timeline Record Details</h3>
              <button className="modal-close" onClick={() => setSelectedDetails(null)} type="button"><i className="ph ph-x" aria-hidden="true" /></button>
            </div>
            <div className="modal-body">
              <div className="apt-modal-details-grid">
                <div className="apt-modal-detail-row"><span>Event Type</span><strong>{selectedDetails.event_type}</strong></div>
                <div className="apt-modal-detail-row"><span>Title</span><strong>{selectedDetails.title}</strong></div>
                <div className="apt-modal-detail-row"><span>Description</span><strong>{selectedDetails.description || 'N/A'}</strong></div>
                <div className="apt-modal-detail-row"><span>Timestamp</span><strong>{formatDateTime(selectedDetails.occurred_at)}</strong></div>
                <div className="apt-modal-detail-row"><span>Recorded by</span><strong>{selectedDetails.created_by_name || selectedDetails.created_by || 'System'}</strong></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="doc-btn" onClick={() => setSelectedDetails(null)} type="button">Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
