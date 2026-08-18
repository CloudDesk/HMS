import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  appointmentsApi,
  type ApiAppointmentStatus,
  type AppointmentListResponse,
  type AppointmentResponse,
} from '../api/appointments';
import { doctorsApi, type DoctorResponse } from '../api/doctors';
import { Toast } from '../components/ui/Toast';
import { navigate, useAppLocation } from '../routing/navigation';
import {
  appointmentPriorityClass,
  appointmentPriorityLabels,
  appointmentStatusClass,
  appointmentStatusLabels,
  appointmentVisitTypeLabels,
  formatAppointmentDate,
  formatAppointmentTime,
  getAppointmentErrorMessage,
  todayInputValue,
} from './appointment-utils';

type SortColumn = 'appointment_date' | 'start_time' | 'created_at';
type SortDirection = 'asc' | 'desc';

const buildDashboardUrl = (
  search: string,
  status: ApiAppointmentStatus | '',
  dateFrom: string,
  dateTo: string,
  doctorFilter: string,
  page: number,
  sortColumn: SortColumn,
  sortDirection: SortDirection,
) => {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (status) params.set('status', status);
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);
  if (doctorFilter) params.set('doctor_id', doctorFilter);
  if (page > 1) params.set('page', String(page));
  params.set('sortBy', sortColumn);
  params.set('sortOrder', sortDirection);

  const query = params.toString();
  return `/appointments${query ? `?${query}` : ''}`;
};

const countByStatus = (appointments: AppointmentResponse[], status: ApiAppointmentStatus) =>
  appointments.filter((appointment) => appointment.status === status).length;

const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const buildTrend = (appointments: AppointmentResponse[], anchorDate: string) => {
  const anchor = new Date(`${anchorDate || todayInputValue()}T00:00:00`);
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(anchor);
    date.setDate(anchor.getDate() - (6 - index));
    const key = toInputDate(date);
    return {
      label: new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(date),
      value: appointments.filter((appointment) => appointment.appointment_date.slice(0, 10) === key).length,
    };
  });
};

export function AppointmentDashboardPage() {
  const location = useAppLocation();
  const initialParams = new URLSearchParams(location.search);
  const [appointments, setAppointments] = useState<AppointmentResponse[]>([]);
  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState(initialParams.get('search') ?? '');
  const [doctorFilter, setDoctorFilter] = useState(initialParams.get('doctor_id') ?? '');
  const [statusFilter, setStatusFilter] = useState<ApiAppointmentStatus | ''>(
    (initialParams.get('status') as ApiAppointmentStatus | null) ?? '',
  );
  const [dateFrom, setDateFrom] = useState(initialParams.get('date_from') ?? todayInputValue());
  const [dateTo, setDateTo] = useState(initialParams.get('date_to') ?? todayInputValue());
  const [currentPage, setCurrentPage] = useState(Number(initialParams.get('page')) || 1);
  const [sortColumn, setSortColumn] = useState<SortColumn>(
    (initialParams.get('sortBy') as SortColumn | null) ?? 'appointment_date',
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    initialParams.get('sortOrder') === 'desc' ? 'desc' : 'asc',
  );
  const [meta, setMeta] = useState<AppointmentListResponse['meta']>({
    limit: 10,
    page: 1,
    total: 0,
    totalPages: 1,
  });
  const [updatingStatusId, setUpdatingStatusId] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');

  const kpis = useMemo(
    () => [
      {
        icon: 'ph-calendar-check',
        label: "Today's Appointments",
        value: meta.total,
        copy: 'Across all departments',
      },
      {
        icon: 'ph-check-circle',
        label: 'Completed',
        value: countByStatus(appointments, 'COMPLETED'),
        copy: 'Consultations closed',
      },
      {
        icon: 'ph-stethoscope',
        label: 'In Progress',
        value: countByStatus(appointments, 'CHECKED_IN'),
        copy: 'Currently consulting',
      },
      {
        icon: 'ph-x-circle',
        label: 'Cancelled / No Show',
        value: countByStatus(appointments, 'CANCELLED') + countByStatus(appointments, 'NO_SHOW'),
        copy: 'Requires follow-up',
      },
      {
        icon: 'ph-calendar-plus',
        label: 'Upcoming',
        value:
          countByStatus(appointments, 'SCHEDULED') +
          countByStatus(appointments, 'CONFIRMED') +
          countByStatus(appointments, 'SKIPPED'),
        copy: 'Today and selected range',
      },
    ],
    [appointments, meta.total],
  );
  const trend = useMemo(() => buildTrend(appointments, dateTo || todayInputValue()), [appointments, dateTo]);
  const maxTrend = Math.max(1, ...trend.map((point) => point.value));
  const upcomingAppointments = appointments.filter((appointment) =>
    ['SCHEDULED', 'CONFIRMED', 'SKIPPED'].includes(appointment.status),
  );

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastTone(tone);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };

  const loadLookups = useCallback(async () => {
    try {
      const doctorResponse = await doctorsApi.list({ status: 'ACTIVE', limit: 100, sortBy: 'display_name', sortOrder: 'asc' });
      setDoctors(doctorResponse.data);
    } catch (error) {
      console.error('Failed to load doctors', error);
    }
  }, []);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const response = await appointmentsApi.list({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        doctor_id: doctorFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page: currentPage,
        limit: 10,
        sortBy: sortColumn,
        sortOrder: sortDirection,
      });
      setAppointments(response.data);
      setMeta(response.meta);
    } catch (error) {
      setAppointments([]);
      setMeta({ limit: 10, page: currentPage, total: 0, totalPages: 1 });
      setLoadError(getAppointmentErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [currentPage, dateFrom, dateTo, doctorFilter, search, sortColumn, sortDirection, statusFilter]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const handleSort = (column: SortColumn) => {
    setSortColumn((current) => {
      if (current === column) {
        setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
        return current;
      }
      setSortDirection('asc');
      return column;
    });
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setDoctorFilter('');
    setDateFrom(todayInputValue());
    setDateTo(todayInputValue());
    setSortColumn('appointment_date');
    setSortDirection('asc');
    setCurrentPage(1);
  };

  const updateStatus = async (appointment: AppointmentResponse, status: ApiAppointmentStatus) => {
    setUpdatingStatusId(appointment.id);

    try {
      await appointmentsApi.updateStatus(appointment.id, { status });
      showToast(`Appointment marked ${appointmentStatusLabels[status].toLowerCase()}.`);
      await loadAppointments();
    } catch (error) {
      showToast(getAppointmentErrorMessage(error), 'error');
    } finally {
      setUpdatingStatusId('');
    }
  };

  return (
    <>
      <div className="appointment-page">
        <section className="appointment-page-header">
          <div className="appointment-page-title">
            <h2>Appointment Dashboard</h2>
            <p>Monitor booking records, arrival readiness, and the front-desk schedule.</p>
          </div>
          <div className="doctor-page-actions">
            <button className="doc-btn primary" style={{ cursor: 'default' }} type="button">
              <i className="ph ph-calendar-plus" aria-hidden="true" />
              Book Appointment
            </button>
          </div>
        </section>

        <section className="doc-kpi-grid appointment-kpi-grid">
          {kpis.map((kpi) => (
            <article className="doc-kpi-card" key={kpi.label}>
              <i className={`ph ${kpi.icon}`} aria-hidden="true" />
              <div>
                <span>{kpi.label}</span>
                <strong>{loading ? '-' : kpi.value}</strong>
                <small>{kpi.copy}</small>
              </div>
            </article>
          ))}
        </section>

        <section className="appointment-dashboard-grid">
          <article className="doc-card">
            <div className="doc-card-header">
              <div>
                <h3>Appointment Trend</h3>
                <p>Daily appointments for the current week</p>
              </div>
            </div>
            <div className="doc-chart">
              <svg className="doc-line-chart" viewBox="0 0 700 220" role="img" aria-label="Appointment trend chart">
                {[0, 1, 2, 3, 4].map((line) => (
                  <line key={line} x1="30" x2="680" y1={30 + line * 38} y2={30 + line * 38} />
                ))}
                <polyline
                  points={trend
                    .map((point, index) => `${30 + index * 108},${190 - (point.value / maxTrend) * 150}`)
                    .join(' ')}
                />
                {trend.map((point, index) => (
                  <circle cx={30 + index * 108} cy={190 - (point.value / maxTrend) * 150} key={point.label} r="4" />
                ))}
              </svg>
              <div className="doc-chart-axis">
                {trend.map((point) => (
                  <span key={point.label}>{point.label}</span>
                ))}
              </div>
            </div>
          </article>

          <article className="doc-card">
            <div className="doc-card-header">
              <div>
                <h3>Quick Actions</h3>
                <p>Front-desk workflows</p>
              </div>
            </div>
            <div className="appointment-quick-grid">
              {(
                [
                  ['ph-calendar-plus', 'Book Appointment', 'Reserve a consultation time'],
                  ['ph-person-simple-walk', 'Walk-in Registration', 'Check in an unscheduled patient'],
                  ['ph-calendar-blank', 'Calendar View', 'Review all schedules'],
                  ['ph-queue', 'Queue Management', 'Coordinate waiting patients'],
                  ['ph-magnifying-glass', 'Search Patient', 'Open the patient directory'],
                ] as const
              ).map(([icon, label, copy]) => (
                <button className="appointment-quick-action" key={label} style={{ cursor: 'default' }} type="button">
                  <i className={`ph ${icon}`} aria-hidden="true" />
                  <span>
                    <strong>{label}</strong>
                    <span>{copy}</span>
                  </span>
                </button>
              ))}
            </div>
          </article>
        </section>

        <section className="appointment-dashboard-grid appointment-dashboard-grid-secondary">
          <article className="doc-card">
            <div className="doc-card-header">
              <div>
                <h3>Upcoming Appointments</h3>
                <p>Next confirmed bookings</p>
              </div>
              <button className="doc-btn" style={{ cursor: 'default' }} type="button">
                View Calendar
              </button>
            </div>
            <div className="doc-appointment-list">
              {upcomingAppointments.length === 0 ? (
                <div className="um-state-cell">No upcoming appointments found for the selected filters.</div>
              ) : (
                upcomingAppointments.slice(0, 5).map((appointment) => (
                  <div className="doc-appointment-item" key={appointment.id}>
                    <span>{appointment.start_time}</span>
                    <span className="doc-avatar">{appointment.patient_name.slice(0, 2).toUpperCase()}</span>
                    <div className="doc-appointment-copy">
                      <strong>{appointment.patient_name}</strong>
                      <span>
                        {appointment.doctor_name} - {appointmentVisitTypeLabels[appointment.visit_type]}
                      </span>
                    </div>
                    <span className={`doc-status ${appointmentStatusClass(appointment.status)}`}>
                      {appointmentStatusLabels[appointment.status]}
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="doc-card">
            <div className="doc-card-header">
              <div>
                <h3>Notifications</h3>
                <p>Appointment and queue updates</p>
              </div>
            </div>
            <div className="appointment-notice-list">
              <div className="appointment-notice">
                <i className="ph ph-queue" aria-hidden="true" />
                <div>
                  <strong>Queue ready for calling</strong>
                  <span>{upcomingAppointments.length} appointments are waiting or scheduled.</span>
                </div>
              </div>
              <div className="appointment-notice warning">
                <i className="ph ph-clock-countdown" aria-hidden="true" />
                <div>
                  <strong>{countByStatus(appointments, 'SKIPPED')} skipped tokens</strong>
                  <span>Skipped patients remain after regular waiting tokens.</span>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section className="doc-toolbar">
          <div className="doc-field grow doc-search">
            <label htmlFor="appointment-search">Search Appointment</label>
            <i className="ph ph-magnifying-glass" aria-hidden="true" />
            <input
              id="appointment-search"
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search appointment, MRN, patient, doctor, or specialty"
              type="search"
              value={search}
            />
          </div>
          <div className="doc-field">
            <label htmlFor="appointment-status">Status</label>
            <select
              id="appointment-status"
              onChange={(event) => {
                setStatusFilter(event.target.value as ApiAppointmentStatus | '');
                setCurrentPage(1);
              }}
              value={statusFilter}
            >
              <option value="">All statuses</option>
              {Object.entries(appointmentStatusLabels).map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="doc-field">
            <label htmlFor="appointment-doctor">Doctor</label>
            <select
              id="appointment-doctor"
              onChange={(event) => {
                setDoctorFilter(event.target.value);
                setCurrentPage(1);
              }}
              value={doctorFilter}
            >
              <option value="">All Doctors</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.display_name}
                </option>
              ))}
            </select>
          </div>
          <div className="doc-field">
            <label htmlFor="appointment-date-from">From</label>
            <input
              id="appointment-date-from"
              onChange={(event) => {
                setDateFrom(event.target.value);
                setCurrentPage(1);
              }}
              type="date"
              value={dateFrom}
            />
          </div>
          <div className="doc-field">
            <label htmlFor="appointment-date-to">To</label>
            <input
              id="appointment-date-to"
              onChange={(event) => {
                setDateTo(event.target.value);
                setCurrentPage(1);
              }}
              type="date"
              value={dateTo}
            />
          </div>
          <button className="doc-btn" onClick={resetFilters} type="button">
            Reset
          </button>
        </section>

        <section className="doc-card">
          <div className="doc-card-header">
            <div>
              <h3>Appointment Records</h3>
              <p>{loading ? 'Loading schedule...' : `${meta.total} records found`}</p>
            </div>
          </div>

          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('appointment_date')}>Time</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Visit</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th onClick={() => handleSort('created_at')}>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="um-state-cell" colSpan={8}>
                      Loading appointments...
                    </td>
                  </tr>
                ) : loadError ? (
                  <tr>
                    <td className="um-state-cell" colSpan={8}>
                      {loadError}
                      <div>
                        <button className="doc-btn mt-4" onClick={loadAppointments} type="button">
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : appointments.length === 0 ? (
                  <tr>
                    <td className="um-state-cell" colSpan={8}>
                      No appointments found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  appointments.map((appointment) => (
                    <tr key={appointment.id}>
                      <td>
                        <strong>{formatAppointmentTime(appointment)}</strong>
                        <br />
                        <small>{formatAppointmentDate(appointment.appointment_date)}</small>
                      </td>
                      <td>
                        <div className="doc-person">
                          <span className="doc-avatar">{appointment.patient_name.slice(0, 2).toUpperCase()}</span>
                          <div>
                            <strong>{appointment.patient_name}</strong>
                            <span>{appointment.patient_number}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>{appointment.doctor_name}</strong>
                        <br />
                        <small>{appointment.doctor_specialization}</small>
                      </td>
                      <td>{appointmentVisitTypeLabels[appointment.visit_type]}</td>
                      <td>
                        <span className={`status-badge ${appointmentPriorityClass(appointment.priority)}`}>
                          {appointmentPriorityLabels[appointment.priority]}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${appointmentStatusClass(appointment.status)}`}>
                          {appointmentStatusLabels[appointment.status]}
                        </span>
                      </td>
                      <td>{formatAppointmentDate(appointment.created_at)}</td>
                      <td>
                        <div className="doc-actions">
                          <button
                            className="doc-action"
                            onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(appointment.patient_id)}`)}
                            title="Open patient"
                            type="button"
                          >
                            <i className="ph ph-user" aria-hidden="true" />
                          </button>
                          <button
                            className="doc-action"
                            disabled={updatingStatusId === appointment.id || appointment.status === 'CONFIRMED'}
                            onClick={() => updateStatus(appointment, 'CONFIRMED')}
                            title="Confirm appointment"
                            type="button"
                          >
                            <i className="ph ph-check-circle" aria-hidden="true" />
                          </button>
                          <button
                            className="doc-action"
                            disabled={updatingStatusId === appointment.id || appointment.status === 'CHECKED_IN'}
                            onClick={() => updateStatus(appointment, 'CHECKED_IN')}
                            title="Mark checked in"
                            type="button"
                          >
                            <i className="ph ph-user-focus" aria-hidden="true" />
                          </button>
                          <button
                            className="doc-action danger"
                            disabled={updatingStatusId === appointment.id || appointment.status === 'CANCELLED'}
                            onClick={() => updateStatus(appointment, 'CANCELLED')}
                            title="Cancel appointment"
                            type="button"
                          >
                            <i className="ph ph-x" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="um-pagination">
            <span>
              Showing {appointments.length === 0 ? 0 : (meta.page - 1) * meta.limit + 1}-
              {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} appointments
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
        </section>
      </div>

      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />
    </>
  );
}
