import { useMemo, useState } from 'react';
import {
  type DoctorScheduleAppointment as AppointmentResponse,
  type DoctorScheduleAppointmentStatus as ApiAppointmentStatus,
  type DoctorScheduleAppointmentVisitType as ApiAppointmentVisitType,
  type DoctorScheduleViewMode,
  useDoctorSchedule,
} from '../hooks/doctors/useDoctorSchedule';
import { navigate, useAppLocation } from '../routing/navigation';
import {
  appointmentStatusLabels,
  appointmentVisitTypeLabels,
  todayInputValue,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from './appointment-utils';
import { statusTone, visitTypeText } from './doctor-workflow-utils';
import { useFirstDayOfWeek } from '../hooks/settings/useSettings';
import { patientInitials } from './opd-utils';

const scheduleTimes = Array.from({ length: 22 }).map((_, index) => {
  const totalMinutes = 8 * 60 + index * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
});

const calendarTimes = Array.from({ length: 11 }).map((_, index) => `${String(index + 8).padStart(2, '0')}:00`);

const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const parseScheduleDateParam = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return todayInputValue();
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value
    : todayInputValue();
};

const parseScheduleDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date(`${todayInputValue()}T00:00:00`) : date;
};

const appointmentDateKey = (appointment: AppointmentResponse) => appointment.appointment_date.slice(0, 10);



const buildScheduleRange = (mode: DoctorScheduleViewMode, selectedDate: string, firstDayOfWeek: 'Monday' | 'Sunday') => {
  if (mode === 'day') {
    return { from: selectedDate, to: selectedDate };
  }

  if (mode === 'month') {
    return { from: toInputDate(startOfMonth(selectedDate)), to: toInputDate(endOfMonth(selectedDate)) };
  }

  return { from: toInputDate(startOfWeek(selectedDate, firstDayOfWeek)), to: toInputDate(endOfWeek(selectedDate, firstDayOfWeek)) };
};

const scheduleViewModes: DoctorScheduleViewMode[] = ['day', 'week', 'month'];
const appointmentStatuses: ApiAppointmentStatus[] = [
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
  'CANCELLED',
  'RESCHEDULED',
  'NO_SHOW',
  'SKIPPED',
  'COMPLETED',
];
const appointmentVisitTypes: ApiAppointmentVisitType[] = [
  'NEW_CONSULTATION',
  'FOLLOW_UP',
  'PROCEDURE',
  'EMERGENCY',
];

const parseViewMode = (value: string | null): DoctorScheduleViewMode =>
  scheduleViewModes.find((mode) => mode === value) ?? 'day';

const parseAppointmentStatus = (value: string | null): ApiAppointmentStatus | '' =>
  appointmentStatuses.find((status) => status === value) ?? '';

const parseVisitType = (value: string | null): ApiAppointmentVisitType | '' =>
  appointmentVisitTypes.find((visitType) => visitType === value) ?? '';

const buildWeekDays = (selectedDate: string, firstDayOfWeek: 'Monday' | 'Sunday') => {
  const weekStart = startOfWeek(selectedDate, firstDayOfWeek);
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return toInputDate(date);
  });
};

type CalendarMonthCell = {
  date: string;
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
};

const buildFullMonthGrid = (selectedDate: string): CalendarMonthCell[] => {
  const start = startOfMonth(selectedDate);
  const end = endOfMonth(selectedDate);
  const currentMonth = start.getMonth();
  const todayStr = todayInputValue();

  const gridStart = new Date(start);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const cells: CalendarMonthCell[] = [];
  const cursor = new Date(gridStart);

  while (cells.length < 35 || (cells.length < 42 && cursor <= end)) {
    const dStr = toInputDate(cursor);
    cells.push({
      date: dStr,
      dayNum: cursor.getDate(),
      isCurrentMonth: cursor.getMonth() === currentMonth,
      isToday: dStr === todayStr,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  while (cells.length % 7 !== 0) {
    const dStr = toInputDate(cursor);
    cells.push({
      date: dStr,
      dayNum: cursor.getDate(),
      isCurrentMonth: cursor.getMonth() === currentMonth,
      isToday: dStr === todayStr,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return cells;
};

const formatScheduleDay = (value: string) =>
  new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', weekday: 'short' }).format(parseScheduleDate(value));

const scheduleEventClass = (appointment: AppointmentResponse) => {
  if (appointment.status === 'CANCELLED' || appointment.status === 'NO_SHOW') return 'cancelled';
  if (appointment.visit_type === 'FOLLOW_UP') return 'follow-up';
  if (appointment.visit_type === 'PROCEDURE') return 'procedure';
  if (appointment.visit_type === 'EMERGENCY') return 'emergency';
  return '';
};

const formatDentalContext = (appointment: AppointmentResponse): string | null => {
  if (!appointment.dental_context) return null;
  const parts = ['Dental'];
  if (appointment.dental_context.tooth_number) {
    parts.push(`Tooth ${appointment.dental_context.tooth_number}`);
  }
  if (appointment.dental_context.stage_sequence) {
    parts.push(`Stage ${appointment.dental_context.stage_sequence}`);
  } else if (appointment.dental_context.treatment_stage_id) {
    parts.push('Stage');
  }
  return parts.join(' • ');
};

export function DoctorSchedulePage() {
  const { search } = useAppLocation();
  const initialParams = new URLSearchParams(search);
  const [visitTypeFilter, setVisitTypeFilter] = useState<ApiAppointmentVisitType | ''>(() =>
    parseVisitType(initialParams.get('visit_type')),
  );
  const [statusFilter, setStatusFilter] = useState<ApiAppointmentStatus | ''>(() =>
    parseAppointmentStatus(initialParams.get('status')),
  );
  const [scheduleDate, setScheduleDate] = useState(() =>
    parseScheduleDateParam(initialParams.get('date')),
  );
  const [viewMode, setViewMode] = useState<DoctorScheduleViewMode>(() =>
    parseViewMode(initialParams.get('view')),
  );
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  const { firstDayOfWeek } = useFirstDayOfWeek();

  const scheduleRange = useMemo(() => buildScheduleRange(viewMode, scheduleDate, firstDayOfWeek), [scheduleDate, viewMode, firstDayOfWeek]);
  const weekDays = useMemo(() => buildWeekDays(scheduleDate, firstDayOfWeek), [scheduleDate, firstDayOfWeek]);
  const schedule = useDoctorSchedule({
    initialDoctorId: initialParams.get('doctor_id') ?? '',
    visitType: visitTypeFilter,
    status: statusFilter,
    scheduleDate,
    viewMode,
    dateFrom: scheduleRange.from,
    dateTo: scheduleRange.to,
    today: todayInputValue(),
  });
  const selectedDoctor =
    schedule.doctors.find((doctor) => doctor.id === schedule.selectedDoctorId) ?? null;
  const appointmentByStart = useMemo(
    () =>
      schedule.appointments.reduce<Record<string, AppointmentResponse>>((result, appointment) => {
        result[appointment.start_time] = appointment;
        return result;
      }, {}),
    [schedule.appointments],
  );

  const fullMonthCells = useMemo(() => buildFullMonthGrid(scheduleDate), [scheduleDate]);

  const selectedAppointment = useMemo(
    () => schedule.appointments.find((apt) => apt.id === selectedAppointmentId) ?? null,
    [schedule.appointments, selectedAppointmentId],
  );

  const doctorTitle = selectedDoctor
    ? `— ${selectedDoctor.display_name.startsWith('Dr.') ? selectedDoctor.display_name : `Dr. ${selectedDoctor.display_name}`}`
    : '';

  const moveDate = (offset: number) => {
    const next = new Date(`${scheduleDate}T00:00:00`);
    if (viewMode === 'month') {
      next.setMonth(next.getMonth() + offset);
    } else if (viewMode === 'week') {
      next.setDate(next.getDate() + offset * 7);
    } else {
      next.setDate(next.getDate() + offset);
    }
    setScheduleDate(toInputDate(next));
  };

  const bannerTitle = useMemo(() => {
    const d = parseScheduleDate(scheduleDate);
    if (viewMode === 'month') {
      return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d).toUpperCase();
    }
    if (viewMode === 'week') {
      const start = startOfWeek(scheduleDate, 'Sunday');
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const startStr = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start).toUpperCase();
      const endStr = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(end).toUpperCase();
      return `WEEK OF ${startStr} - ${endStr}`;
    }
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(d).toUpperCase();
  }, [scheduleDate, viewMode]);

  const appointmentsFor = (day: string, slot?: string) =>
    schedule.appointments.filter((appointment) => {
      const sameDay = appointmentDateKey(appointment) === day;
      return sameDay && (!slot || appointment.start_time.startsWith(slot.slice(0, 2)));
    });

  return (
    <>
      <div className="doctor-page hms-cal-page-wrap">
        <main className="hms-cal-main-area">
          {/* Top Bar: Title + TODAY + DAY/WEEK/MONTH + Book Appointment */}
          <div className="hms-cal-top-header">
            <h2 className="hms-cal-page-heading">
              Doctor Schedule {doctorTitle}
            </h2>
            <div className="hms-cal-controls-group">
              <button
                className="hms-cal-today-btn"
                onClick={() => setScheduleDate(todayInputValue())}
                type="button"
              >
                Today
              </button>
              <div className="hms-cal-view-modes">
                {scheduleViewModes.map((mode) => (
                  <button
                    className={`hms-cal-view-mode-btn${viewMode === mode ? ' active' : ''}`}
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    type="button"
                  >
                    {mode.toUpperCase()}
                  </button>
                ))}
              </div>
              {schedule.canBookAppointments ? (
                <button
                  className="doc-btn primary"
                  onClick={() => navigate('/appointments/book')}
                  type="button"
                >
                  <i className="ph ph-plus" aria-hidden="true" />
                  Book Appointment
                </button>
              ) : null}
            </div>
          </div>

          {/* Filter Toolbar */}
          <section className="doc-toolbar hms-schedule-toolbar" style={{ marginTop: 0 }}>
            <div className="doc-field schedule-filter-doctor">
              <label htmlFor="schedule-doctor">Doctor</label>
              <select disabled={schedule.isDoctor} id="schedule-doctor" onChange={(event) => schedule.setSelectedDoctorId(event.target.value)} value={schedule.selectedDoctorId}>
                {schedule.doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="doc-field schedule-filter-type">
              <label htmlFor="schedule-type">Appointment Type</label>
              <select
                id="schedule-type"
                onChange={(event) => setVisitTypeFilter(parseVisitType(event.target.value))}
                value={visitTypeFilter}
              >
                <option value="">All Types</option>
                {Object.entries(appointmentVisitTypeLabels)
                  .filter(([value]) => value !== 'EMERGENCY')
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </select>
            </div>
            <div className="doc-field schedule-filter-status">
              <label htmlFor="schedule-status">Status</label>
              <select
                id="schedule-status"
                onChange={(event) => setStatusFilter(parseAppointmentStatus(event.target.value))}
                value={statusFilter}
              >
                <option value="">All Statuses</option>
                {Object.entries(appointmentStatusLabels)
                  .filter(([value]) => value !== 'EMERGENCY')
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </select>
            </div>
            <div className="doc-field schedule-filter-date">
              <label htmlFor="schedule-date">Date</label>
              <input id="schedule-date" onChange={(event) => setScheduleDate(event.target.value)} type="date" value={scheduleDate} />
            </div>
          </section>

          {/* Visit Type Legend */}
          <div className="appointment-calendar-legend">
            <span>
              <i /> Appointments / General
            </span>
            <span>
              <i className="green" /> Follow-ups
            </span>
            <span>
              <i className="purple" /> Procedures
            </span>
            <span>
              <i className="cyan" /> Telemedicine / Referral
            </span>
            <span>
              <i className="red" /> Emergency
            </span>
            <span>
              <i className="muted" /> Cancelled / No show
            </span>
          </div>

            {/* Calendar Container with Theme Blue Banner */}
            <div className="hms-cal-container">
              {/* Solid Theme Blue Header Banner */}
              <div className="hms-cal-banner">
                <button
                  aria-label="Previous period"
                  className="hms-cal-banner-nav-btn"
                  onClick={() => moveDate(-1)}
                  type="button"
                >
                  <i className="ph ph-caret-left-bold" />
                </button>
                <h3 className="hms-cal-banner-title">{bannerTitle}</h3>
                <button
                  aria-label="Next period"
                  className="hms-cal-banner-nav-btn"
                  onClick={() => moveDate(1)}
                  type="button"
                >
                  <i className="ph ph-caret-right-bold" />
                </button>
              </div>

              {schedule.isLoading ? (
                <div className="um-state-cell" style={{ padding: '3rem 1rem' }}>Loading doctor schedule...</div>
              ) : schedule.error ? (
                <div className="um-state-cell" style={{ padding: '3rem 1rem' }}>{schedule.error}</div>
              ) : schedule.doctors.length === 0 ? (
                <div className="um-state-cell" style={{ padding: '3rem 1rem' }}>No active doctors are available for schedule review.</div>
              ) : viewMode === 'month' ? (
                <>
                  {/* Weekday Columns Header */}
                  <div className="hms-cal-weekdays-row">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                      <div className="hms-cal-weekday-header" key={d}>
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Month Grid Cells */}
                  <div className="hms-cal-month-grid">
                    {fullMonthCells.map((cell) => {
                      const dayAppts = appointmentsFor(cell.date);
                      return (
                        <div
                          className={`hms-cal-month-cell ${cell.isCurrentMonth ? '' : 'is-other-month'} ${cell.isToday ? 'is-today' : ''}`}
                          key={cell.date}
                        >
                          <div className="hms-cal-cell-header">
                            <span className="hms-cal-day-num">{cell.dayNum}</span>
                          </div>
                          <div className="hms-cal-events-wrap">
                            {dayAppts.slice(0, 3).map((appointment, idx) => {
                              const isCancelled = appointment.status === 'CANCELLED' || appointment.status === 'NO_SHOW';
                              const isRef = Boolean(
                                (appointment.notes && appointment.notes.toLowerCase().includes('referral')) ||
                                (appointment.reason && appointment.reason.toLowerCase().includes('referral'))
                              );
                              const typeClass = isCancelled
                                ? 'pill-muted'
                                : appointment.visit_type === 'EMERGENCY'
                                  ? 'pill-red'
                                  : appointment.visit_type === 'PROCEDURE'
                                    ? 'pill-purple'
                                    : appointment.visit_type === 'FOLLOW_UP'
                                      ? 'pill-green'
                                      : isRef
                                        ? 'pill-cyan'
                                        : 'pill-blue';
                              const lineClass = isCancelled
                                ? 'line-muted'
                                : appointment.visit_type === 'EMERGENCY'
                                  ? 'line-red'
                                  : appointment.visit_type === 'PROCEDURE'
                                    ? 'line-purple'
                                    : appointment.visit_type === 'FOLLOW_UP'
                                      ? 'line-green'
                                      : isRef
                                        ? 'line-cyan'
                                        : 'line-blue';
                              const isSolid = !isCancelled && (appointment.visit_type === 'EMERGENCY' || appointment.visit_type === 'PROCEDURE' || idx === 0);

                              return isSolid ? (
                                <button
                                  className={`hms-cal-event-pill ${typeClass}`}
                                  key={appointment.id}
                                  onClick={() => setSelectedAppointmentId(appointment.id)}
                                  title={`${appointment.start_time} - ${appointment.patient_name}`}
                                  type="button"
                                >
                                  {appointment.start_time} {appointment.patient_name}
                                </button>
                              ) : (
                                <button
                                  className={`hms-cal-event-line ${lineClass}`}
                                  key={appointment.id}
                                  onClick={() => setSelectedAppointmentId(appointment.id)}
                                  title={`${appointment.start_time} - ${appointment.patient_name}`}
                                  type="button"
                                >
                                  <strong>{appointment.start_time}</strong> {appointment.patient_name}
                                </button>
                              );
                            })}
                            {dayAppts.length > 3 ? (
                              <button
                                className="hms-cal-more-link"
                                onClick={() => {
                                  setScheduleDate(cell.date);
                                  setViewMode('day');
                                }}
                                type="button"
                              >
                                +{dayAppts.length - 3} more
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : viewMode === 'week' ? (
                <div className="calendar-scroll">
                  <div className="appointment-calendar">
                    <div className="appointment-calendar-head">
                      <span>Time</span>
                      {weekDays.map((day) => (
                        <span className={day === todayInputValue() ? 'today' : ''} key={day}>
                          {formatScheduleDay(day)}
                        </span>
                      ))}
                    </div>
                    {calendarTimes.map((time) => (
                      <div className="appointment-calendar-row" key={time}>
                        <div className="appointment-calendar-time">{time}</div>
                        {weekDays.map((day) => (
                          <div className="appointment-calendar-cell" key={`${day}-${time}`}>
                            {appointmentsFor(day, time).map((appointment) => (
                              <button
                                className={`appointment-calendar-event ${scheduleEventClass(appointment)}`}
                                key={appointment.id}
                                onClick={() => setSelectedAppointmentId(appointment.id)}
                                type="button"
                              >
                                <strong>
                                  {appointment.start_time} - {appointment.patient_name}
                                </strong>
                                <span>
                                  {formatDentalContext(appointment) ? `${formatDentalContext(appointment)} • ` : ''}
                                  {visitTypeText(appointment.visit_type)}
                                </span>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="doctor-schedule-grid">
                  <div className="doctor-schedule-head">Time</div>
                  <div className="doctor-schedule-head">Appointments & Time Slots</div>
                  {scheduleTimes.map((time) => {
                    const appointment = appointmentByStart[time];
                    return (
                      <div className="doctor-schedule-row" key={time}>
                        <div className="doctor-schedule-time">{time}</div>
                        <div className="doctor-schedule-slot">
                          {appointment ? (
                            <button
                              className={`doctor-schedule-event ${statusTone(appointment.status)}`}
                              onClick={() => setSelectedAppointmentId(appointment.id)}
                              type="button"
                            >
                              <span>
                                <strong>
                                  {appointment.start_time} - {appointment.patient_name}
                                </strong>
                                <small>
                                  {formatDentalContext(appointment) ? (
                                    <span style={{ fontWeight: 600, color: '#0369a1', marginRight: 6 }}>
                                      [{formatDentalContext(appointment)}]
                                    </span>
                                  ) : null}
                                  {visitTypeText(appointment.visit_type)} - {appointment.doctor_specialization}
                                </small>
                              </span>
                              <span className={`doc-status ${statusTone(appointment.status)}`}>
                                {appointmentStatusLabels[appointment.status]}
                              </span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Floating Action Button (FAB) from Reference Image */}
              {/* {schedule.canBookAppointments ? (
                <button
                  className="hms-cal-fab-btn"
                  onClick={() => navigate('/appointments/book')}
                  title="Book New Appointment"
                  type="button"
                >
                  <i className="ph ph-plus-bold" aria-hidden="true" />
                </button>
              ) : null} */}
            </div>
          </main>
        </div>

      {/* Appointment Details Modal */}
      {selectedAppointment ? (
        <div className="modal-backdrop" onClick={() => setSelectedAppointmentId(null)}>
          <div className="modal-box apt-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Appointment Details</h3>
              <button className="modal-close" onClick={() => setSelectedAppointmentId(null)} type="button">
                <i className="ph ph-x" aria-hidden="true" />
              </button>
            </div>

            <div className="modal-body">
              <div className="apt-modal-patient-strip">
                <div className="opd-patient-avatar-box">
                  <span>{patientInitials(selectedAppointment.patient_name)}</span>
                </div>
                <div className="apt-modal-patient-info">
                  <h4>{selectedAppointment.patient_name}</h4>
                  <p>{selectedAppointment.patient_number || 'Patient number not recorded'}</p>
                  <div className="apt-modal-patient-sub">
                    <span>
                      {selectedAppointment.appointment_date.slice(0, 10)} • {selectedAppointment.start_time}
                    </span>
                    <span>{appointmentVisitTypeLabels[selectedAppointment.visit_type]}</span>
                    <span className="doc-status active">
                      {appointmentStatusLabels[selectedAppointment.status]}
                    </span>
                  </div>
                </div>
              </div>

              <div className="apt-modal-details-grid">
                <div className="apt-modal-detail-row">
                  <span>Appointment ID</span>
                  <strong>{selectedAppointment.appointment_number}</strong>
                </div>
                <div className="apt-modal-detail-row">
                  <span>Doctor</span>
                  <strong>{selectedAppointment.doctor_name}</strong>
                </div>
                <div className="apt-modal-detail-row">
                  <span>Department</span>
                  <strong>{selectedAppointment.doctor_specialization || 'Not recorded'}</strong>
                </div>
                {formatDentalContext(selectedAppointment) ? (
                  <div className="apt-modal-detail-row">
                    <span>Dental Context</span>
                    <strong style={{ color: '#0369a1' }}>
                      {formatDentalContext(selectedAppointment)}
                    </strong>
                  </div>
                ) : null}
                <div className="apt-modal-detail-row">
                  <span>Visit Type</span>
                  <strong>{appointmentVisitTypeLabels[selectedAppointment.visit_type]}</strong>
                </div>
                <div className="apt-modal-detail-row">
                  <span>Priority</span>
                  <strong>{selectedAppointment.priority}</strong>
                </div>
                <div className="apt-modal-detail-row">
                  <span>Duration</span>
                  <strong>{selectedAppointment.duration_minutes} Minutes</strong>
                </div>
                {selectedAppointment.reason ? (
                  <div className="apt-modal-detail-row" style={{ gridColumn: 'span 2' }}>
                    <span>Chief Complaint / Reason</span>
                    <strong>{selectedAppointment.reason}</strong>
                  </div>
                ) : null}
                {selectedAppointment.notes ? (
                  <div className="apt-modal-detail-row" style={{ gridColumn: 'span 2' }}>
                    <span>Notes</span>
                    <strong>{selectedAppointment.notes}</strong>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="modal-footer apt-modal-footer">
              <button
                className="doc-btn"
                onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(selectedAppointment.patient_id)}`)}
                type="button"
              >
                Open Patient Profile
              </button>
              <button
                className="doc-btn"
                onClick={() => navigate(`/appointments/calendar?date=${selectedAppointment.appointment_date.slice(0, 10)}`)}
                type="button"
              >
                Manage in Calendar
              </button>
              <button
                className="doc-btn primary"
                onClick={() => setSelectedAppointmentId(null)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
