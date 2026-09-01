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
import { useTimezone } from '../api/useSettings';
import { useFirstDayOfWeek } from '../hooks/settings/useSettings';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

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
      departmentFilter,
      doctorFilter,
      statusFilter,
      departments,
      visibleDoctors,
      branches,
      appointments,
      loading,
      loadError,
      loggedInDoctor,
      isUpdatingAppointment,
      isUpdatingStatus,
    },
    actions: {
      setMode,
      setCalendarDate,
      setDepartmentFilter,
      setDoctorFilter,
      setStatusFilter,
      handleUpdateAppointment,
      handleUpdateStatus,
    }
  } = useAppointmentCalendarFeature();

  const timezone = useTimezone();

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

  return (
    <>
      <div className="appointment-page">
        <section className="appointment-page-header">
          <div className="appointment-page-title">
            <h2>Calendar View</h2>
            <p>Manage appointments across doctors and departments</p>
          </div>
          <div className="appointment-page-actions">
            <button className="doc-btn" onClick={() => setCalendarDate(todayInputValue())} type="button">
              Today
            </button>
            <button className="doc-btn primary" onClick={() => navigate('/appointments/book')} type="button">
              <i className="ph ph-plus" aria-hidden="true" />
              New Appointment
            </button>
            <button className="doc-btn" onClick={() => window.print()} type="button">
              <i className="ph ph-printer" aria-hidden="true" />
              Print Calendar
            </button>
            <button className="doc-btn" onClick={handleExport} type="button">
              <i className="ph ph-download-simple" aria-hidden="true" />
              Export
            </button>
          </div>
        </section>

        <section className="doc-toolbar">
          <div className="doc-segmented">
            {(['day', 'week', 'month'] as const).map((item) => (
              <button className={mode === item ? 'active' : ''} key={item} onClick={() => setMode(item)} type="button">
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
          <div className="doc-field">
            <label htmlFor="calendar-department">Department</label>
            <select
              id="calendar-department"
              disabled={Boolean(loggedInDoctor)}
              onChange={(event) => {
                setDepartmentFilter(event.target.value);
                setDoctorFilter('');
              }}
              value={departmentFilter}
            >
              <option value="">All Departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
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

        {loadError ? <div className="form-error-banner">{loadError}</div> : null}

        <div className="appointment-calendar-legend">
          <span>
            <i /> Appointments
          </span>
          <span>
            <i className="cyan" style={{ background: '#06b6d4' }} /> Specialist Referrals
          </span>
          <span>
            <i className="green" /> Follow-ups
          </span>
          <span>
            <i className="purple" /> Procedures
          </span>
          <span>
            <i className="red" /> Emergency
          </span>
          <span>
            <i className="muted" /> Cancelled / No show
          </span>
        </div>

        <section className="doc-card calendar-card">
          {loading ? <div className="um-state-cell">Loading appointment calendar...</div> : null}

          {!loading && mode !== 'month' ? (
            <div className="calendar-scroll">
              <div className={`appointment-calendar ${mode === 'day' ? 'is-day' : ''}`}>
                <div className="appointment-calendar-head">
                  <span>Time</span>
                  {(mode === 'day' ? [dateKey(calendarDate)] : weekDays).map((day) => (
                    <span className={day === todayInputValue() ? 'today' : ''} key={day}>
                      {getDayHeader(day)}
                    </span>
                  ))}
                </div>
                {timeSlots.map((slot) => (
                  <div className="appointment-calendar-row" key={slot}>
                    <div className="appointment-calendar-time">{slot}</div>
                    {(mode === 'day' ? [dateKey(calendarDate)] : weekDays).map((day) => {
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
                            e.preventDefault();
                            setDragOverCellKey(cellKey);
                          }}
                          onDrop={() => void handleDrop(day, slot)}
                        >
                          {appointmentsFor(day, slot).map((appointment) => (
                            <button
                              className={`appointment-calendar-event ${eventClass(appointment)}`}
                              draggable
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
          ) : null}

          {!loading && mode === 'month' ? (
            <div className="calendar-scroll">
              <div className="appointment-month">
                {monthDays.map((day) => {
                  const isOver = dragOverCellKey === day;
                  return (
                    <div
                      className={`appointment-month-day ${day === todayInputValue() ? 'today' : ''} ${
                        isOver ? 'is-drag-over' : ''
                      }`}
                      key={day}
                      onDragLeave={() => setDragOverCellKey(null)}
                      onDragOver={(e) => {
                        if (day < todayInputValue()) return;
                        e.preventDefault();
                        setDragOverCellKey(day);
                      }}
                      onDrop={() => void handleDrop(day)}
                    >
                      <strong>{getMobileDayHeader(day)}</strong>
                      {appointmentsFor(day).slice(0, 4).map((appointment) => (
                        <button
                          className={`appointment-calendar-event ${eventClass(appointment)}`}
                          draggable
                          key={appointment.id}
                          onClick={() => setSelectedAppointmentId(appointment.id)}
                          onDragStart={(e) => {
                            setDraggedAppointmentId(appointment.id);
                            e.dataTransfer.setData('text/plain', appointment.id);
                          }}
                          type="button"
                        >
                          <strong>
                            {appointment.start_time} - {appointment.patient_name}
                          </strong>
                          <span>{appointment.doctor_name}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>
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
              <button
                className="doc-btn"
                onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(selectedAppointment.patient_id)}`)}
                type="button"
              >
                Open Patient Profile
              </button>
              <button
                className="doc-btn danger-outline"
                disabled={selectedAppointment.status === 'CANCELLED' || isUpdatingStatus}
                onClick={() => { setIsCancelling(true); setIsRescheduling(false); }}
                type="button"
              >
                Cancel Appointment
              </button>
              <button
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
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
