import type { ProcedureBooking } from '../../api/surgery';
import type { ServiceResponse } from '../../api/services';
import { StatusBadge } from '../ui/StatusBadge';
import { MedicalLoader } from '../ui/MedicalLoader';

export type SurgeryScheduleTabProps = {
  scheduleRows: ProcedureBooking[];
  services: ServiceResponse[];
  date: string;
  isLoading: boolean;
  isError: boolean;
  onSelect: (item: ProcedureBooking) => void;
  statusTone: (status: string) => 'green' | 'red' | 'orange' | 'blue';
};

function RequirementFlags({
  booking,
  service,
}: {
  booking: ProcedureBooking;
  service?: { requires_bed: boolean; requires_consent: boolean; requires_advance_deposit: boolean };
}) {
  const snapshot = booking.prerequisite_snapshot;
  return (
    <div className="requirement-flags">
      <span className={!service?.requires_bed || Boolean(booking.hold_id) ? 'met' : 'blocked'}>
        Bed: {!service?.requires_bed ? 'Not required' : booking.hold_id ? 'Held' : 'Required'}
      </span>
      <span
        className={
          !service?.requires_consent ||
          Boolean(booking.consent_document_id) ||
          Boolean(snapshot)
            ? 'met'
            : 'blocked'
        }
      >
        Consent:{' '}
        {!service?.requires_consent
          ? 'Not required'
          : booking.consent_document_id || snapshot
            ? 'Linked'
            : 'Required'}
      </span>
      <span
        className={
          !service?.requires_advance_deposit ||
          Boolean(booking.deposit_invoice_id) ||
          Boolean(snapshot)
            ? 'met'
            : 'blocked'
        }
      >
        Deposit:{' '}
        {!service?.requires_advance_deposit
          ? 'Not required'
          : booking.deposit_invoice_id || snapshot
            ? 'Linked'
            : 'Required'}
      </span>
    </div>
  );
}

export function SurgeryScheduleTab({
  scheduleRows,
  services,
  date,
  isLoading,
  isError,
  onSelect,
  statusTone,
}: SurgeryScheduleTabProps) {
  return (
    <section className="surgery-table-card surgery-schedule-board">
      <div className="surgery-schedule-header-bar">
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '1.05rem',
              fontWeight: 700,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <i className="ph ph-calendar-check" style={{ color: '#0284c7' }} />
            Procedure Schedule Board
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
            All procedure schedules for{' '}
            <strong>
              {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </strong>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              background: '#eff6ff',
              color: '#1e40af',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.76rem',
              fontWeight: 600,
            }}
          >
            {scheduleRows.length} Scheduled
          </span>
        </div>
      </div>
      {isLoading ? (
        <div style={{ padding: '3rem 1rem' }}>
          <MedicalLoader
            text="Loading surgical procedure schedule..."
            subtext="Accessing operating theater calendar"
          />
        </div>
      ) : isError ? (
        <div
          className="error-state"
          style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}
        >
          Unable to load the procedure schedule.
        </div>
      ) : scheduleRows.length === 0 ? (
        <div
          className="empty-state"
          style={{
            padding: '3rem 1rem',
            textAlign: 'center',
            background: '#f8fafc',
            borderRadius: '8px',
            border: '1px dashed #cbd5e1',
          }}
        >
          <i
            className="ph ph-calendar-x"
            style={{ fontSize: '2rem', color: '#94a3b8', marginBottom: '8px', display: 'block' }}
          />
          <strong style={{ color: '#334155', display: 'block', fontSize: '0.92rem' }}>
            No Procedures Scheduled for this Date
          </strong>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.8rem' }}>
            Select another date above or book a pending recommendation.
          </p>
        </div>
      ) : (
        <div className="surgery-schedule-list">
          {scheduleRows.map((item) => (
            <div className={`surgery-schedule-card status-${item.status}`} key={item.id}>
              <div className="surgery-schedule-time">
                <strong>
                  <i className="ph ph-clock" style={{ color: '#0284c7', fontSize: '1.1rem' }} />
                  {new Date(item.scheduled_start).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </strong>
                <small>Duration: {item.duration_minutes} min</small>
              </div>

              <div className="surgery-schedule-main">
                <div className="surgery-schedule-patient-row">
                  <span className="surgery-schedule-patient-name">{item.patient_name}</span>
                  <span className="surgery-schedule-mrn">{item.patient_number}</span>
                  <span className="surgery-schedule-booking-num">{item.booking_number}</span>
                </div>

                <div className="surgery-schedule-meta">
                  <span className="surgery-schedule-meta-item">
                    <i className="ph ph-heartbeat" />
                    <strong>{item.service_name}</strong>
                  </span>
                  <span className="surgery-schedule-meta-item">
                    <i className="ph ph-user-md" />
                    {item.doctor_name}
                  </span>
                  <span className="surgery-schedule-meta-item">
                    <i className="ph ph-buildings" />
                    {item.department_name}
                  </span>
                </div>

                <div style={{ marginTop: '2px' }}>
                  <RequirementFlags
                    booking={item}
                    service={services.find((service) => service.id === item.service_id)}
                  />
                </div>
              </div>

              <div className="surgery-schedule-actions">
                <StatusBadge tone={statusTone(item.status)}>
                  {item.status.replaceAll('_', ' ')}
                </StatusBadge>
                <button
                  type="button"
                  className="btn-secondary compact"
                  onClick={() => onSelect(item)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    background: '#f8fafc',
                  }}
                >
                  <i className="ph ph-sliders" /> Review
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
