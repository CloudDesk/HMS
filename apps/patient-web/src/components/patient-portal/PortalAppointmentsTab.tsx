import type { UseQueryResult } from '@tanstack/react-query';
import type { PortalAppointment, PublicList } from '../../api/patient-portal';
import { date, label } from '../../utils/portal-invoice-pdf';

type PortalAppointmentsTabProps = {
  appointmentsQuery: UseQueryResult<PublicList<PortalAppointment>>;
  appointmentScope: 'upcoming' | 'past';
  setAppointmentScope: (scope: 'upcoming' | 'past') => void;
  appointmentStatus: PortalAppointment['status'] | '';
  setAppointmentStatus: (status: PortalAppointment['status'] | '') => void;
  appointmentPage: number;
  setAppointmentPage: React.Dispatch<React.SetStateAction<number>>;
  onOpenBooking: () => void;
  onReschedule: (appointment: PortalAppointment) => void;
};

export function PortalAppointmentsTab({
  appointmentsQuery,
  appointmentScope,
  setAppointmentScope,
  appointmentStatus,
  setAppointmentStatus,
  appointmentPage,
  setAppointmentPage,
  onOpenBooking,
  onReschedule,
}: PortalAppointmentsTabProps) {
  return (
    <section className="portal-page-section portal-appointments-page">
      <header>
        <div style={{ width: '100%' }}>
          <p>My care schedule</p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              gap: '1rem',
            }}
          >
            <h1 style={{ margin: 0 }}>Appointments</h1>
            <button className="portal-book-action" onClick={onOpenBooking} type="button">
              <i className="ph ph-calendar-plus" /> Book appointment
            </button>
          </div>
          <span>Review upcoming visits and your complete appointment history.</span>
        </div>
      </header>

      <div className="portal-appointment-toolbar">
        <div className="portal-appointment-tabs" role="tablist" aria-label="Appointment period">
          <button
            aria-selected={appointmentScope === 'upcoming'}
            className={appointmentScope === 'upcoming' ? 'active' : ''}
            onClick={() => {
              setAppointmentScope('upcoming');
              setAppointmentStatus('');
            }}
            role="tab"
            type="button"
          >
            <i className="ph ph-calendar-check" /> Upcoming
          </button>
          <button
            aria-selected={appointmentScope === 'past'}
            className={appointmentScope === 'past' ? 'active' : ''}
            onClick={() => {
              setAppointmentScope('past');
              setAppointmentStatus('');
            }}
            role="tab"
            type="button"
          >
            <i className="ph ph-clock-counter-clockwise" /> Past & history
          </button>
        </div>
        <div className="portal-appointment-status-filter">
          <span>Status</span>
          <select
            onChange={(event) =>
              setAppointmentStatus(event.target.value as PortalAppointment['status'] | '')
            }
            value={appointmentStatus}
          >
            <option value="">All statuses</option>
            {(appointmentScope === 'upcoming'
              ? ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN']
              : ['COMPLETED', 'NO_SHOW', 'SKIPPED', 'RESCHEDULED', 'CANCELLED']
            ).map((status) => (
              <option key={status} value={status}>
                {label(status)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="portal-list-panel">
        {appointmentsQuery.isLoading ? (
          <div className="portal-empty">
            <div className="portal-spinner" />
            <strong>Loading appointments…</strong>
          </div>
        ) : appointmentsQuery.isError ? (
          <div className="portal-empty">
            <i className="ph ph-warning-circle" />
            <strong>Appointments could not be loaded</strong>
            <button onClick={() => void appointmentsQuery.refetch()} type="button">
              Try again
            </button>
          </div>
        ) : appointmentsQuery.data?.data.length ? (
          appointmentsQuery.data.data.map((item) => (
            <article className="portal-list-row" key={item.id}>
              <div className="portal-list-icon">
                <i className="ph ph-calendar-blank" />
              </div>
              <div className="portal-list-main">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <h3 style={{ margin: 0 }}>{item.doctor_name}</h3>
                  <span
                    className="portal-op-visit-badge"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.15rem 0.55rem',
                      borderRadius: '999px',
                      background: '#e0f2fe',
                      color: '#0284c7',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      lineHeight: '1.4',
                    }}
                  >
                    <i className="ph ph-stethoscope" /> OP Visit
                  </span>
                  <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                    {item.doctor_specialization}
                  </span>
                </div>
                <p>
                  <i className="ph ph-calendar" /> {date(item.appointment_date)} &nbsp;{' '}
                  <i className="ph ph-clock" /> {item.start_time}–{item.end_time}
                </p>
                {item.branch ? (
                  <small>
                    <i className="ph ph-map-pin" /> {item.branch.name}
                    {item.branch.address
                      ? ` · ${item.branch.address}`
                      : item.branch.city
                        ? ` · ${item.branch.city}`
                        : ''}
                  </small>
                ) : null}
                <small>{item.reason || label(item.visit_type)}</small>
              </div>
              <div className="portal-list-end">
                <span className={`portal-status ${item.status.toLowerCase()}`}>
                  {label(item.status)}
                </span>
                <small>{item.appointment_number}</small>
                {['SCHEDULED', 'CONFIRMED', 'NO_SHOW', 'SKIPPED'].includes(item.status) ? (
                  <button
                    className="portal-reschedule-action"
                    onClick={() => onReschedule(item)}
                    type="button"
                  >
                    <i className="ph ph-calendar-dots" /> Reschedule
                  </button>
                ) : null}
                {item.status === 'RESCHEDULED' && item.rescheduled_to_id ? (
                  <span className="portal-history-note">
                    <i className="ph ph-arrow-bend-down-right" /> Replaced by a new appointment
                  </span>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="portal-empty">
            <i className="ph ph-calendar-x" />
            <strong>
              {appointmentScope === 'upcoming'
                ? 'No upcoming appointments'
                : 'No appointment history'}
            </strong>
            <span>
              {appointmentScope === 'upcoming'
                ? 'Use Book appointment to choose a doctor and live available time.'
                : 'Completed, missed and rescheduled appointments will appear here.'}
            </span>
          </div>
        )}
      </div>

      {appointmentsQuery.data && appointmentsQuery.data.meta.totalPages > 1 ? (
        <nav className="portal-appointment-pagination" aria-label="Appointment pages">
          <button
            disabled={appointmentPage <= 1}
            onClick={() => setAppointmentPage((page) => page - 1)}
            type="button"
          >
            <i className="ph ph-caret-left" /> Previous
          </button>
          <span>
            Page {appointmentsQuery.data.meta.page} of {appointmentsQuery.data.meta.totalPages}
          </span>
          <button
            disabled={appointmentPage >= appointmentsQuery.data.meta.totalPages}
            onClick={() => setAppointmentPage((page) => page + 1)}
            type="button"
          >
            Next <i className="ph ph-caret-right" />
          </button>
        </nav>
      ) : null}
    </section>
  );
}
