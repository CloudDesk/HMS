import { useMemo, useState } from 'react';
import { type ApiAppointmentStatus, type AppointmentResponse } from '../api/appointments';
import { navigate } from '../routing/navigation';
import {
  appointmentStatusLabels,
  appointmentVisitTypeLabels,
  todayInputValue,
  toInputDate,
  parseInputDate,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  formatAppointmentTime,
} from './appointment-utils';
import { patientInitials } from './opd-utils';
import { toast } from 'sonner';
import { useAppointmentCalendarFeature } from '../hooks/appointments/useAppointmentCalendarFeature';
import { useFirstDayOfWeek } from '../hooks/settings/useSettings';
import { format } from 'date-fns';
import { AppointmentConsultationIntake } from '../components/appointments/AppointmentConsultationIntake';

const timeSlots = Array.from({ length: 11 }).map((_, index) => `${String(index + 8).padStart(2, '0')}:00`);

const dateKey = (value: string) => toInputDate(parseInputDate(value));

const appointmentDateKey = (appointment: AppointmentResponse) => appointment.appointment_date.slice(0, 10);

const isReferral = (appointment: AppointmentResponse) => {
  return Boolean(
    (appointment.notes && appointment.notes.toLowerCase().includes('referred')) ||
      (appointment.reason && appointment.reason.toLowerCase().includes('referral')),
  );
};

const eventClass = (appointment: AppointmentResponse) => {
  if (appointment.status === 'CANCELLED' || appointment.status === 'NO_SHOW') return 'cancelled';
  if (isReferral(appointment)) return 'referral';
  if (appointment.visit_type === 'FOLLOW_UP') return 'follow-up';
  if (appointment.visit_type === 'PROCEDURE') return 'procedure';
  if (appointment.visit_type === 'EMERGENCY') return 'emergency';
  return '';
};

const buildWeekDays = (selectedDate: string, firstDayOfWeek: 'Monday' | 'Sunday') => {
  const weekStart = startOfWeek(selectedDate, firstDayOfWeek);
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return toInputDate(date);
  });
};

const buildMonthDays = (selectedDate: string) => {
  const start = startOfMonth(selectedDate);
  const end = endOfMonth(selectedDate);
  const days: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    days.push(toInputDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
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

  // Always start on Sunday to match standard calendar view in reference
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

const downloadAppointments = (appointments: AppointmentResponse[]) => {
  const rows = [
    ['Appointment No', 'Date', 'Time', 'Patient', 'Doctor', 'Visit Type', 'Status'],
    ...appointments.map((appointment) => [
      appointment.appointment_number,
      appointmentDateKey(appointment),
      `${appointment.start_time}-${appointment.end_time}`,
      appointment.patient_name,
      appointment.doctor_name,
      appointmentVisitTypeLabels[appointment.visit_type],
      appointmentStatusLabels[appointment.status],
    ]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `appointment-calendar-${todayInputValue()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

export function AppointmentCalendarPage() {
  const {
    state: {
      mode,
      calendarDate,
      doctorFilter,
      statusFilter,
      visibleDoctors,
      branches,
      appointments,
      loading,
      loadError,
      loggedInDoctor,
      isUpdatingAppointment,
      isUpdatingStatus,
      canBook,
      canEditBooking,
      canEditStatus,
      canViewPatient,
    },
    actions: {
      setMode,
      setCalendarDate,
      setDoctorFilter,
      setStatusFilter,
      handleUpdateAppointment,
      handleUpdateStatus,
    }
  } = useAppointmentCalendarFeature();

  const getDayHeader = (value: string) => {
    try {
      const parsed = parseInputDate(value);
      if (Number.isNaN(parsed.getTime())) return value;
      return format(parsed, 'd MMM, EEE');
    } catch {
      return value;
    }
  };

  const getMobileDayHeader = (value: string) => {
    try {
      const parsed = parseInputDate(value);
      if (Number.isNaN(parsed.getTime())) return value;
      return format(parsed, 'd EEE');
    } catch {
      return value;
    }
  };

  // Drag and Drop State & Active Modal State
  const [draggedAppointmentId, setDraggedAppointmentId] = useState<string | null>(null);
  const [dragOverCellKey, setDragOverCellKey] = useState<string | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const selectedAppointment = appointments.find((a) => a.id === selectedAppointmentId) ?? null;
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  const { firstDayOfWeek } = useFirstDayOfWeek();

  const weekDays = useMemo(() => buildWeekDays(calendarDate, firstDayOfWeek), [calendarDate, firstDayOfWeek]);
  const monthDays = useMemo(() => buildMonthDays(calendarDate), [calendarDate]);

  const appointmentsFor = (day: string, slot?: string) =>
    appointments.filter((appointment) => {
      const sameDay = appointmentDateKey(appointment) === day;
      return sameDay && (!slot || appointment.start_time.startsWith(slot.slice(0, 2)));
    });

  const handleExport = () => {
    downloadAppointments(appointments);
    toast.success('Calendar export downloaded.');
  };

  const handleDrop = async (targetDate: string, targetSlot?: string) => {
    setDragOverCellKey(null);
    if (!draggedAppointmentId) return;

    const targetAppointment = appointments.find((a) => a.id === draggedAppointmentId);
    if (!targetAppointment) return;

    const newStartTime = targetSlot || targetAppointment.start_time;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    if (targetDate < todayInputValue() || (targetDate === todayInputValue() && newStartTime < currentTime)) {
      toast.error('Appointments cannot be rescheduled to a past date or time.');
      return;
    }

    setSelectedAppointmentId(draggedAppointmentId);
    setRescheduleDate(targetDate);
    setRescheduleTime(newStartTime);
    setRescheduleReason('');
    setIsRescheduling(true);
    setDraggedAppointmentId(null);
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!cancellationReason.trim()) { toast.error('Cancellation reason is required.'); return; }
    await handleUpdateStatus(appointmentId, {
      status: 'CANCELLED',
      notes: cancellationReason.trim(),
    });
    setIsCancelling(false); setCancellationReason('');
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment || !rescheduleDate || !rescheduleTime || !rescheduleReason.trim()) return;

    await handleUpdateAppointment(selectedAppointment.id, {
      appointment_date: rescheduleDate,
      start_time: rescheduleTime,
      reschedule_reason: rescheduleReason.trim(),
    });
    setIsRescheduling(false);
  };

  const fullMonthCells = useMemo(() => buildFullMonthGrid(calendarDate), [calendarDate]);

  const moveCalendarDate = (offset: number) => {
    const current = parseInputDate(calendarDate);
    if (mode === 'month') {
      current.setMonth(current.getMonth() + offset);
    } else if (mode === 'week') {
      current.setDate(current.getDate() + offset * 7);
    } else {
      current.setDate(current.getDate() + offset);
    }
    setCalendarDate(toInputDate(current));
  };

  const bannerTitle = useMemo(() => {
    const d = parseInputDate(calendarDate);
    if (mode === 'month') {
      return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d).toUpperCase();
    }
    if (mode === 'week') {
      const start = startOfWeek(calendarDate, 'Sunday');
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const startStr = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start).toUpperCase();
      const endStr = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(end).toUpperCase();
      return `WEEK OF ${startStr} - ${endStr}`;
    }
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(d).toUpperCase();
  }, [calendarDate, mode]);

  return (
    <>
      <div className="appointment-page hms-cal-page-wrap">
        <main className="hms-cal-main-area">
          {/* Top Bar: Title + TODAY + DAY/WEEK/MONTH + Book Appointment */}
          <div className="hms-cal-top-header">
            <h2 className="hms-cal-page-heading">Calendar View</h2>
            <div className="hms-cal-controls-group">
              <div className="hms-cal-view-modes">
                {(['day', 'week', 'month'] as const).map((item) => (
                  <button
                    className={`hms-cal-view-mode-btn${mode === item ? ' active' : ''}`}
                    key={item}
                    onClick={() => setMode(item)}
                    type="button"
                  >
                    {item.toUpperCase()}
                  </button>
                ))}
              </div>
              {canBook ? (
                <button
                  className="doc-btn primary"
                  onClick={() => navigate('/appointments/book')}
                  type="button"
                >
                  <i className="ph ph-plus" aria-hidden="true" />
                  Book Appointment
                </button>
              ) : null}
              <button className="doc-btn" onClick={handleExport} style={{ marginLeft: '4px' }} title="Export CSV" type="button">
                <i className="ph ph-download-simple" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Filter Toolbar */}
          <section className="doc-toolbar" style={{ marginTop: 0 }}>
            <div className="doc-field">
              <label htmlFor="calendar-doctor">Doctor</label>
              <select 
                id="calendar-doctor" 
                disabled={Boolean(loggedInDoctor)}
                onChange={(event) => setDoctorFilter(event.target.value)} 
                value={doctorFilter}
              >
                <option value="">All Doctors</option>
                {visibleDoctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="doc-field">
              <label htmlFor="calendar-status">Appointment Status</label>
              <select
                id="calendar-status"
                onChange={(event) => setStatusFilter(event.target.value as ApiAppointmentStatus | '')}
                value={statusFilter}
              >
                <option value="">All Statuses</option>
                {Object.entries(appointmentStatusLabels).map(([status, label]) => (
                  <option key={status} value={status}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="doc-field">
              <label htmlFor="calendar-date">Date</label>
              <input id="calendar-date" onChange={(event) => setCalendarDate(event.target.value)} type="date" value={calendarDate} />
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

            {loadError ? <div className="form-error-banner">{loadError}</div> : null}

            {/* Calendar Container with Theme Blue Banner */}
            <div className="hms-cal-container">
              {/* Solid Theme Blue Header Banner */}
              <div className="hms-cal-banner">
                <button
                  aria-label="Previous period"
                  className="hms-cal-banner-nav-btn"
                  onClick={() => moveCalendarDate(-1)}
                  type="button"
                >
                  <i className="ph ph-caret-left" />
                </button>
                <h3 className="hms-cal-banner-title">{bannerTitle}</h3>
                <button
                  aria-label="Next period"
                  className="hms-cal-banner-nav-btn"
                  onClick={() => moveCalendarDate(1)}
                  type="button"
                >
                  <i className="ph ph-caret-right" />
                </button>
              </div>

              {loading ? (
                <div className="um-state-cell" style={{ padding: '3rem 1rem' }}>
                  Loading appointment calendar...
                </div>
              ) : mode === 'month' ? (
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
                      const isOver = dragOverCellKey === cell.date;
                      return (
                        <div
                          className={`hms-cal-month-cell ${cell.isCurrentMonth ? '' : 'is-other-month'} ${cell.isToday ? 'is-today' : ''} ${isOver ? 'is-drag-over' : ''}`}
                          key={cell.date}
                          onDragLeave={() => setDragOverCellKey(null)}
                          onDragOver={(e) => {
                            if (cell.date < todayInputValue()) return;
                            if (!canEditBooking) return;
                            e.preventDefault();
                            setDragOverCellKey(cell.date);
                          }}
                          onDrop={() => { if (canEditBooking) void handleDrop(cell.date); }}
                        >
                          <div className="hms-cal-cell-header">
                            <span className="hms-cal-day-num">{cell.dayNum}</span>
                          </div>
                          <div className="hms-cal-events-wrap">
                            {dayAppts.slice(0, 3).map((appointment, idx) => {
                              const isCancelled = appointment.status === 'CANCELLED' || appointment.status === 'NO_SHOW';
                              const isRef = isReferral(appointment);
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
                                  draggable={canEditBooking}
                                  key={appointment.id}
                                  onClick={() => setSelectedAppointmentId(appointment.id)}
                                  onDragStart={(e) => {
                                    setDraggedAppointmentId(appointment.id);
                                    e.dataTransfer.setData('text/plain', appointment.id);
                                  }}
                                  title={`${appointment.start_time} - ${appointment.patient_name} (${appointment.doctor_name})`}
                                  type="button"
                                >
                                  {appointment.start_time} {appointment.patient_name}
                                </button>
                              ) : (
                                <button
                                  className={`hms-cal-event-line ${lineClass}`}
                                  draggable={canEditBooking}
                                  key={appointment.id}
                                  onClick={() => setSelectedAppointmentId(appointment.id)}
                                  onDragStart={(e) => {
                                    setDraggedAppointmentId(appointment.id);
                                    e.dataTransfer.setData('text/plain', appointment.id);
                                  }}
                                  title={`${appointment.start_time} - ${appointment.patient_name} (${appointment.doctor_name})`}
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
                                  setCalendarDate(cell.date);
                                  setMode('day');
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
              ) : mode === 'week' ? (
                <div className="calendar-scroll">
                  <div className="appointment-calendar">
                    <div className="appointment-calendar-head">
                      <span>Time</span>
                      {weekDays.map((day) => (
                        <span className={day === todayInputValue() ? 'today' : ''} key={day}>
                          {getDayHeader(day)}
                        </span>
                      ))}
                    </div>
                    {timeSlots.map((slot) => (
                      <div className="appointment-calendar-row" key={slot}>
                        <div className="appointment-calendar-time">{slot}</div>
                        {weekDays.map((day) => {
                          const cellKey = `${day}-${slot}`;
                          const isOver = dragOverCellKey === cellKey;
                          return (
                            <div
                              className={`appointment-calendar-cell ${isOver ? 'is-drag-over' : ''}`}
                              key={cellKey}
                              onDragLeave={() => setDragOverCellKey(null)}
                              onDragOver={(e) => {
                                const now = new Date();
                                const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                                if (day < todayInputValue() || (day === todayInputValue() && slot < currentTime)) return;
                                if (!canEditBooking) return;
                                e.preventDefault();
                                setDragOverCellKey(cellKey);
                              }}
                              onDrop={() => { if (canEditBooking) void handleDrop(day, slot); }}
                            >
                              {appointmentsFor(day, slot).map((appointment) => (
                                <button
                                  className={`appointment-calendar-event ${eventClass(appointment)}`}
                                  draggable={canEditBooking}
                                  key={appointment.id}
                                  onClick={() => setSelectedAppointmentId(appointment.id)}
                                  onDragStart={(e) => {
                                    setDraggedAppointmentId(appointment.id);
                                    e.dataTransfer.setData('text/plain', appointment.id);
                                  }}
                                  type="button"
                                >
                                  <strong>{formatAppointmentTime(appointment)}</strong>
                                  <div>
                                    <strong>{appointment.patient_name}</strong>
                                    <span>{appointment.doctor_name} - {appointmentVisitTypeLabels[appointment.visit_type]}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="calendar-scroll">
                  <div className="appointment-calendar is-day">
                    <div className="appointment-calendar-head">
                      <span>Time</span>
                      <span className={dateKey(calendarDate) === todayInputValue() ? 'today' : ''}>
                        {getDayHeader(dateKey(calendarDate))}
                      </span>
                    </div>
                    {timeSlots.map((slot) => {
                      const day = dateKey(calendarDate);
                      const cellKey = `${day}-${slot}`;
                      const isOver = dragOverCellKey === cellKey;
                      return (
                        <div className="appointment-calendar-row" key={slot}>
                          <div className="appointment-calendar-time">{slot}</div>
                          <div
                            className={`appointment-calendar-cell ${isOver ? 'is-drag-over' : ''}`}
                            key={cellKey}
                            onDragLeave={() => setDragOverCellKey(null)}
                            onDragOver={(e) => {
                              const now = new Date();
                              const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                              if (day < todayInputValue() || (day === todayInputValue() && slot < currentTime)) return;
                              if (!canEditBooking) return;
                              e.preventDefault();
                              setDragOverCellKey(cellKey);
                            }}
                            onDrop={() => { if (canEditBooking) void handleDrop(day, slot); }}
                          >
                            {appointmentsFor(day, slot).map((appointment) => (
                              <button
                                className={`appointment-calendar-event ${eventClass(appointment)}`}
                                draggable={canEditBooking}
                                key={appointment.id}
                                onClick={() => setSelectedAppointmentId(appointment.id)}
                                onDragStart={(e) => {
                                  setDraggedAppointmentId(appointment.id);
                                  e.dataTransfer.setData('text/plain', appointment.id);
                                }}
                                type="button"
                              >
                                <strong>{formatAppointmentTime(appointment)}</strong>
                                <div>
                                  <strong>{appointment.patient_name}</strong>
                                  <span>{appointment.doctor_name} - {appointmentVisitTypeLabels[appointment.visit_type]}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Floating Action Button (FAB) from Reference Image */}
              {/* {canBook ? (
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
                  <p>
                    {selectedAppointment.patient_number || 'Patient number not recorded'}
                  </p>
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
                {isReferral(selectedAppointment) ? (
                  <div className="apt-modal-detail-row">
                    <span>Referral Info</span>
                    <strong style={{ color: '#0891b2' }}>
                      {selectedAppointment.notes || selectedAppointment.reason || 'Specialist Referral'}
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
                  <span>Branch</span>
                  <strong>
                    {branches.find((b) => b.id === selectedAppointment.branch_id)?.name ?? 'Main Hospital Branch'}
                  </strong>
                </div>
                <div className="apt-modal-detail-row">
                  <span>Duration</span>
                  <strong>{selectedAppointment.duration_minutes} Minutes</strong>
                </div>
              </div>

              <AppointmentConsultationIntake intake={selectedAppointment.consultation_intake} />

              {isRescheduling ? (
                <form className="apt-modal-reschedule-form" onSubmit={(e) => void handleRescheduleSubmit(e)}>
                  <h4>Reschedule Appointment</h4>
                  <div className="doc-form-grid two">
                    <div className="doc-field">
                      <label htmlFor="reschedule-date-input">New Date</label>
                      <input
                        id="reschedule-date-input"
                        onChange={(e) => setRescheduleDate(e.target.value)}
                        required
                        type="date"
                        value={rescheduleDate}
                      />
                    </div>
                    <div className="doc-field"><label htmlFor="reschedule-reason-input">Reason</label><textarea id="reschedule-reason-input" onChange={(e) => setRescheduleReason(e.target.value)} required value={rescheduleReason} /></div>
                    <div className="doc-field">
                      <label htmlFor="reschedule-time-input">New Time</label>
                      <input
                        id="reschedule-time-input"
                        onChange={(e) => setRescheduleTime(e.target.value)}
                        required
                        type="time"
                        value={rescheduleTime}
                      />
                    </div>
                  </div>
                  <div className="apt-modal-reschedule-actions">
                    <button className="doc-btn" onClick={() => setIsRescheduling(false)} type="button">
                      Cancel
                    </button>
                    <button className="doc-btn primary" disabled={isUpdatingAppointment} type="submit">
                      Confirm Reschedule
                    </button>
                  </div>
                </form>
              ) : null}
              {isCancelling ? <form className="apt-modal-reschedule-form" onSubmit={(e) => { e.preventDefault(); void handleCancelAppointment(selectedAppointment.id); }}><h4>Cancel Appointment</h4><div className="doc-field"><label htmlFor="cancellation-reason-input">Cancellation reason</label><textarea id="cancellation-reason-input" onChange={(e) => setCancellationReason(e.target.value)} required value={cancellationReason} /></div><div className="apt-modal-reschedule-actions"><button className="doc-btn" onClick={() => setIsCancelling(false)} type="button">Back</button><button className="doc-btn danger-outline" disabled={isUpdatingStatus} type="submit">Confirm Cancellation</button></div></form> : null}
            </div>

            <div className="modal-footer apt-modal-footer">
              {canViewPatient ? <button
                className="doc-btn"
                onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(selectedAppointment.patient_id)}`)}
                type="button"
              >
                Open Patient Profile
              </button> : null}
              {canEditStatus ? <button
                className="doc-btn danger-outline"
                disabled={selectedAppointment.status === 'CANCELLED' || isUpdatingStatus}
                onClick={() => { setIsCancelling(true); setIsRescheduling(false); }}
                type="button"
              >
                Cancel Appointment
              </button> : null}
              {canEditBooking ? <button
                className="doc-btn primary"
                onClick={() => {
                  setRescheduleDate(selectedAppointment.appointment_date.slice(0, 10));
                  setRescheduleTime(selectedAppointment.start_time);
                  setRescheduleReason('');
                  setIsCancelling(false);
                  setIsRescheduling(true);
                }}
                type="button"
              >
                Reschedule
              </button> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
