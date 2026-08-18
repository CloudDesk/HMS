import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  appointmentsApi,
  type ApiAppointmentStatus,
  type ApiAppointmentVisitType,
  type AppointmentResponse,
} from '../api/appointments';
import { departmentsApi, type DepartmentResponse } from '../api/departments';
import { doctorsApi, type DoctorResponse } from '../api/doctors';
import { useAuth } from '../auth/useAuth';
import { navigate, useAppLocation } from '../routing/navigation';
import {
  appointmentStatusLabels,
  appointmentVisitTypeLabels,
  getAppointmentErrorMessage,
  todayInputValue,
} from './appointment-utils';
import { statusTone, toDisplayDate, visitTypeText } from './doctor-workflow-utils';

type ViewMode = 'day' | 'week' | 'month';

const scheduleTimes = Array.from({ length: 22 }).map((_, index) => {
  const totalMinutes = 8 * 60 + index * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
});

const calendarTimes = Array.from({ length: 11 }).map((_, index) => `${String(index + 8).padStart(2, '0')}:00`);

const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const parseScheduleDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date(`${todayInputValue()}T00:00:00`) : date;
};

const appointmentDateKey = (appointment: AppointmentResponse) => appointment.appointment_date.slice(0, 10);

const startOfWeek = (value: string) => {
  const date = parseScheduleDate(value);
  date.setDate(date.getDate() - date.getDay());
  return date;
};

const endOfWeek = (value: string) => {
  const date = startOfWeek(value);
  date.setDate(date.getDate() + 6);
  return date;
};

const startOfMonth = (value: string) => {
  const date = parseScheduleDate(value);
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const endOfMonth = (value: string) => {
  const date = parseScheduleDate(value);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

const buildScheduleRange = (mode: ViewMode, selectedDate: string) => {
  if (mode === 'day') {
    return { from: selectedDate, to: selectedDate };
  }

  if (mode === 'month') {
    return { from: toInputDate(startOfMonth(selectedDate)), to: toInputDate(endOfMonth(selectedDate)) };
  }

  return { from: toInputDate(startOfWeek(selectedDate)), to: toInputDate(endOfWeek(selectedDate)) };
};

const buildWeekDays = (selectedDate: string) => {
  const weekStart = startOfWeek(selectedDate);
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

const formatScheduleDay = (value: string) =>
  new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', weekday: 'short' }).format(parseScheduleDate(value));

const formatScheduleMonthDay = (value: string) =>
  new Intl.DateTimeFormat('en', { day: 'numeric', weekday: 'short' }).format(parseScheduleDate(value));

const scheduleEventClass = (appointment: AppointmentResponse) => {
  if (appointment.status === 'CANCELLED' || appointment.status === 'NO_SHOW') return 'cancelled';
  if (appointment.visit_type === 'FOLLOW_UP') return 'follow-up';
  if (appointment.visit_type === 'PROCEDURE') return 'procedure';
  if (appointment.visit_type === 'EMERGENCY') return 'emergency';
  return '';
};

const getRelativeDateLabel = (dateStr: string, view: ViewMode) => {
  if (view === 'month') {
    return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(parseScheduleDate(dateStr));
  }
  if (view === 'week') {
    const start = startOfWeek(dateStr);
    const end = endOfWeek(dateStr);
    const startStr = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(start);
    const endStr = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(end);
    return `${startStr} - ${endStr}`;
  }
  
  const selected = parseScheduleDate(dateStr);
  const today = parseScheduleDate(todayInputValue());
  const diffTime = selected.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays === 1) return 'Tomorrow';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(selected);
};

export function DoctorSchedulePage() {
  const { user } = useAuth();
  const isDoctorUser = user?.roles.some((role) => role.code === 'DOCTOR' || role.name.toLowerCase() === 'doctor') ?? false;
  const { search } = useAppLocation();
  const initialParams = new URLSearchParams(search);
  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [appointments, setAppointments] = useState<AppointmentResponse[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState(initialParams.get('doctor_id') ?? '');
  const [departmentFilter, setDepartmentFilter] = useState(initialParams.get('department_id') ?? '');
  const [visitTypeFilter, setVisitTypeFilter] = useState<ApiAppointmentVisitType | ''>(
    (initialParams.get('visit_type') as ApiAppointmentVisitType | null) ?? '',
  );
  const [statusFilter, setStatusFilter] = useState<ApiAppointmentStatus | ''>(
    (initialParams.get('status') as ApiAppointmentStatus | null) ?? '',
  );
  const [scheduleDate, setScheduleDate] = useState(initialParams.get('date') ?? todayInputValue());
  const [viewMode, setViewMode] = useState<ViewMode>((initialParams.get('view') as ViewMode | null) ?? 'day');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const scheduleRange = useMemo(() => buildScheduleRange(viewMode, scheduleDate), [scheduleDate, viewMode]);
  const weekDays = useMemo(() => buildWeekDays(scheduleDate), [scheduleDate]);
  const monthDays = useMemo(() => buildMonthDays(scheduleDate), [scheduleDate]);
  const selectedDoctor = doctors.find((doctor) => doctor.id === selectedDoctorId) ?? null;
  const appointmentByStart = useMemo(
    () =>
      appointments.reduce<Record<string, AppointmentResponse>>((result, appointment) => {
        result[appointment.start_time] = appointment;
        return result;
      }, {}),
    [appointments],
  );

  const loadLookups = useCallback(async () => {
    const [doctorResult, departmentResponse] = await Promise.all([
      isDoctorUser
        ? doctorsApi.getCurrent().then((doctor) => ({ data: [doctor] }))
        : doctorsApi.list({ status: 'ACTIVE', limit: 100, sortBy: 'display_name', sortOrder: 'asc' }),
      departmentsApi.list({ status: 'ACTIVE', limit: 100 }),
    ]);
    setDoctors(doctorResult.data);
    setDepartments(departmentResponse.data);
    setSelectedDoctorId((current) => (isDoctorUser ? doctorResult.data[0]?.id ?? '' : current || doctorResult.data[0]?.id || ''));
  }, [isDoctorUser]);

  const loadAppointments = useCallback(async () => {
    if (!selectedDoctorId) {
      setAppointments([]);
      return;
    }

    const response = await appointmentsApi.list({
      doctor_id: selectedDoctorId,
      department_id: departmentFilter || undefined,
      status: statusFilter || undefined,
      date_from: scheduleRange.from,
      date_to: scheduleRange.to,
      limit: 100,
      sortBy: 'start_time',
      sortOrder: 'asc',
    });

    setAppointments(
      response.data.filter((appointment) => !visitTypeFilter || appointment.visit_type === visitTypeFilter),
    );
  }, [departmentFilter, scheduleRange.from, scheduleRange.to, selectedDoctorId, statusFilter, visitTypeFilter]);

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    void loadLookups()
      .catch((error) => {
        setLoadError(getAppointmentErrorMessage(error));
      })
      .finally(() => setLoading(false));
  }, [loadLookups]);

  useEffect(() => {
    if (!selectedDoctorId) return;
    const params = new URLSearchParams();
    params.set('doctor_id', selectedDoctorId);
    if (departmentFilter) params.set('department_id', departmentFilter);
    if (visitTypeFilter) params.set('visit_type', visitTypeFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (scheduleDate !== todayInputValue()) params.set('date', scheduleDate);
    if (viewMode !== 'day') params.set('view', viewMode);
    const nextUrl = `/doctors/schedule?${params.toString()}`;
    if (window.location.pathname + window.location.search !== nextUrl) {
      navigate(nextUrl, { replace: true });
    }
  }, [departmentFilter, scheduleDate, selectedDoctorId, statusFilter, viewMode, visitTypeFilter]);

  useEffect(() => {
    if (!selectedDoctorId) return;
    setLoading(true);
    setLoadError('');
    void loadAppointments()
      .catch((error) => {
        setAppointments([]);
        setLoadError(getAppointmentErrorMessage(error));
      })
      .finally(() => setLoading(false));
  }, [loadAppointments, selectedDoctorId]);

  const moveDate = (offset: number) => {
    const next = new Date(`${scheduleDate}T00:00:00`);
    next.setDate(next.getDate() + (viewMode === 'month' ? offset * 30 : viewMode === 'week' ? offset * 7 : offset));
    setScheduleDate(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`,
    );
  };

  const appointmentsFor = (day: string, slot?: string) =>
    appointments.filter((appointment) => {
      const sameDay = appointmentDateKey(appointment) === day;
      return sameDay && (!slot || appointment.start_time.startsWith(slot.slice(0, 2)));
    });

  return (
    <>
      <div className="doctor-page">
        <section className="doctor-page-header">
          <div className="doctor-page-title">
            <h2>Doctor Schedule</h2>
            <p>Manage appointments, procedures and blocked time</p>
          </div>
          <div className="doctor-page-actions">
            <button className="doc-btn" onClick={() => window.print()} type="button">
              <i className="ph ph-printer" aria-hidden="true" />
              Print Schedule
            </button>
            <button className="doc-btn primary" onClick={() => navigate('/appointments/book')} type="button">
              <i className="ph ph-plus" aria-hidden="true" />
              Add Schedule
            </button>
          </div>
        </section>

        <section className="doc-toolbar">
          <div className="doc-segmented">
            {(['day', 'week', 'month'] as const).map((mode) => (
              <button
                className={viewMode === mode ? 'active' : ''}
                key={mode}
                onClick={() => setViewMode(mode)}
                type="button"
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <div className="doc-field grow">
            <label htmlFor="schedule-doctor">Doctor</label>
            <select disabled={isDoctorUser} id="schedule-doctor" onChange={(event) => setSelectedDoctorId(event.target.value)} value={selectedDoctorId}>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.display_name}
                </option>
              ))}
            </select>
          </div>
          <div className="doc-field">
            <label htmlFor="schedule-department">Department</label>
            <select
              id="schedule-department"
              onChange={(event) => setDepartmentFilter(event.target.value)}
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
            <label htmlFor="schedule-type">Appointment Type</label>
            <select
              id="schedule-type"
              onChange={(event) => setVisitTypeFilter(event.target.value as ApiAppointmentVisitType | '')}
              value={visitTypeFilter}
            >
              <option value="">All</option>
              {Object.entries(appointmentVisitTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="doc-field">
            <label htmlFor="schedule-status">Status</label>
            <select
              id="schedule-status"
              onChange={(event) => setStatusFilter(event.target.value as ApiAppointmentStatus | '')}
              value={statusFilter}
            >
              <option value="">All</option>
              {Object.entries(appointmentStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="doc-field">
            <label htmlFor="schedule-date">Date</label>
            <input id="schedule-date" onChange={(event) => setScheduleDate(event.target.value)} type="date" value={scheduleDate} />
          </div>
        </section>

        <section className="doc-card">
          <div className="doc-card-header">
            <div>
              <h3>
                {selectedDoctor?.display_name ?? 'Doctor'} - {toDisplayDate(scheduleDate)}
              </h3>
              <p>Click an appointment to open the patient record or manage it from the appointment dashboard.</p>
            </div>
            <div className="doc-inline-actions">
              <button className="doc-btn icon-only" onClick={() => moveDate(-1)} type="button">
                <i className="ph ph-caret-left" aria-hidden="true" />
              </button>
              <button className="doc-btn" onClick={() => setScheduleDate(todayInputValue())} type="button">
                {getRelativeDateLabel(scheduleDate, viewMode)}
              </button>
              <button className="doc-btn icon-only" onClick={() => moveDate(1)} type="button">
                <i className="ph ph-caret-right" aria-hidden="true" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="um-state-cell">Loading doctor schedule...</div>
          ) : loadError ? (
            <div className="um-state-cell">{loadError}</div>
          ) : doctors.length === 0 ? (
            <div className="um-state-cell">No active doctors are available for schedule review.</div>
          ) : viewMode === 'day' ? (
            <div className="doctor-schedule-grid">
              <div className="doctor-schedule-head">Time</div>
              <div className="doctor-schedule-head">Appointments and time slots</div>
              {scheduleTimes.map((time) => {
                const appointment = appointmentByStart[time];
                return (
                  <div className="doctor-schedule-row" key={time}>
                    <div className="doctor-schedule-time">{time}</div>
                    <div className="doctor-schedule-slot">
                      {appointment ? (
                        <button
                          className={`doctor-schedule-event ${statusTone(appointment.status)}`}
                          onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(appointment.patient_id)}`)}
                          type="button"
                        >
                          <span>
                            <strong>
                              {appointment.start_time} - {appointment.patient_name}
                            </strong>
                            <small>
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
                            onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(appointment.patient_id)}`)}
                            type="button"
                          >
                            <strong>
                              {appointment.start_time} - {appointment.patient_name}
                            </strong>
                            <span>{visitTypeText(appointment.visit_type)}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="calendar-scroll">
              <div className="appointment-month">
                {monthDays.map((day) => (
                  <div className={`appointment-month-day ${day === todayInputValue() ? 'today' : ''}`} key={day}>
                    <strong>{formatScheduleMonthDay(day)}</strong>
                    {appointmentsFor(day).slice(0, 4).map((appointment) => (
                      <button
                        className={`appointment-calendar-event ${scheduleEventClass(appointment)}`}
                        key={appointment.id}
                        onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(appointment.patient_id)}`)}
                        type="button"
                      >
                        <strong>
                          {appointment.start_time} - {appointment.patient_name}
                        </strong>
                        <span>{visitTypeText(appointment.visit_type)}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
