import type { PatientTimelineEventResponse } from '../../api/patients';
import { usePatientTimeline } from '../../hooks/patients/usePatients';
import { formatDateTime } from '../../pages/patient-utils';
import { MedicalLoader } from '../ui/MedicalLoader';
import { Modal } from '../ui/Modal';

export type OpdPatientTimelineModalProps = {
  open: boolean;
  onClose: () => void;
  patientId: string | null;
  patientName: string;
  patientNumber: string;
};

const getEventIcon = (eventType: PatientTimelineEventResponse['event_type']) => {
  if (eventType === 'REGISTRATION') return 'ph-stethoscope';
  if (eventType === 'PROFILE_UPDATED') return 'ph-user-switch';
  if (eventType === 'CONSENT_ADDED') return 'ph-shield-check';
  if (eventType === 'DOCUMENT_ADDED') return 'ph-file-text';
  if (eventType === 'DOCUMENT_DELETED') return 'ph-trash';
  if (eventType === 'OPD_VISIT_CREATED') return 'ph-calendar-check';
  if (eventType === 'OPD_VISIT_STATUS_UPDATED') return 'ph-activity';
  if (eventType === 'VITALS_RECORDED') return 'ph-heartbeat';
  if (eventType === 'OPD_CONSULTATION_COMPLETED') return 'ph-check-circle';
  if (eventType === 'OPD_REFERRAL_BOOKED') return 'ph-arrow-square-out';
  return 'ph-clock-counter-clockwise';
};

const getEventCategory = (eventType: PatientTimelineEventResponse['event_type']) => {
  if (eventType === 'REGISTRATION') return 'Registration / Admission';
  if (eventType === 'PROFILE_UPDATED') return 'Profile Updated';
  if (eventType === 'CONSENT_ADDED') return 'Informed Consent';
  if (eventType === 'DOCUMENT_ADDED') return 'Document Uploaded';
  if (eventType === 'DOCUMENT_DELETED') return 'Document Removed';
  if (eventType === 'OPD_VISIT_CREATED') return 'OPD Visit Created';
  if (eventType === 'OPD_VISIT_STATUS_UPDATED') return 'Visit Status Updated';
  if (eventType === 'VITALS_RECORDED') return 'Vitals Recorded';
  if (eventType === 'OPD_CONSULTATION_COMPLETED') return 'Consultation Completed';
  if (eventType === 'OPD_REFERRAL_BOOKED') return 'Referral Booked';
  return 'Clinical Event';
};

export function OpdPatientTimelineModal({
  open,
  onClose,
  patientId,
  patientName,
  patientNumber,
}: OpdPatientTimelineModalProps) {
  const { data, isLoading, isError, error, refetch } = usePatientTimeline(
    open && patientId ? patientId : null,
    { limit: 50 },
    open && Boolean(patientId),
  );

  const timelineEvents = data?.data ?? [];

  return (
    <Modal
      icon="ph-clock-counter-clockwise"
      onClose={onClose}
      open={open}
      size="large"
      title="Patient Timeline & Encounter History"
    >
      <div className="opd-timeline-modal-body">
        {/* Patient Subheader Context */}
        <div className="opd-timeline-patient-strip">
          <div className="opd-timeline-patient-details">
            <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{patientName}</strong>
            <span className="opd-mrn-chip">{patientNumber}</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Historical encounters, investigations, and clinical records
          </span>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div style={{ padding: '2.5rem 1rem', display: 'grid', placeItems: 'center' }}>
            <MedicalLoader text="Loading patient timeline records..." />
          </div>
        ) : isError ? (
          <div className="doc-card" style={{ padding: '1.5rem', textAlign: 'center', color: '#dc2626' }}>
            <p>Unable to load patient timeline ({error instanceof Error ? error.message : 'Unknown error'}).</p>
            <button className="doc-btn" onClick={() => void refetch()} style={{ marginTop: '0.75rem' }} type="button">
              Retry
            </button>
          </div>
        ) : timelineEvents.length === 0 ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>
            <i className="ph ph-clock-counter-clockwise" style={{ fontSize: '2.25rem', color: '#94a3b8', marginBottom: '0.5rem', display: 'block' }} aria-hidden="true" />
            <strong style={{ display: 'block', color: '#0f172a', marginBottom: '0.25rem' }}>No Previous Timeline Events</strong>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>No historical consultations or clinical milestones recorded for this patient yet.</p>
          </div>
        ) : (
          <div className="opd-timeline-events-list">
            {timelineEvents.map((event) => {
              const icon = getEventIcon(event.event_type);
              const category = getEventCategory(event.event_type);
              return (
                <div className="opd-timeline-event-card" key={event.id}>
                  <div className="opd-timeline-event-icon-box">
                    <i className={`ph ${icon}`} aria-hidden="true" />
                  </div>
                  <div className="opd-timeline-event-content">
                    <div className="opd-timeline-event-header">
                      <strong>{event.title}</strong>
                      <span className="opd-timeline-event-time">{formatDateTime(event.occurred_at)}</span>
                    </div>
                    <div className="opd-timeline-event-meta">
                      <span className="opd-timeline-category-tag">{category}</span>
                      {event.created_by_name ? (
                        <span className="opd-timeline-actor">by {event.created_by_name}</span>
                      ) : null}
                    </div>
                    {event.description ? (
                      <p className="opd-timeline-event-desc">{event.description}</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
