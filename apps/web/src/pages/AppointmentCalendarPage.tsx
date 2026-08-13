import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  appointmentsApi,
  type ApiAppointmentStatus,
  type AppointmentResponse,
} from '../api/appointments';
import { departmentsApi, type DepartmentResponse } from '../api/departments';
import { doctorsApi, type DoctorResponse } from '../api/doctors';
import { Toast } from '../components/ui/Toast';
import { navigate, useAppLocation } from '../routing/navigation';
import {
  appointmentStatusLabels,
  appointmentVisitTypeLabels,
  getAppointmentErrorMessage,
  todayInputValue,
} from './appointment-utils';

type CalendarMode = 'day' | 'week' | 'month';

const timeSlots = Array.from({ length: 11 }).map((_, index) => `${String(index + 8).padStart(2, '0')}:00`);

const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const parseInputDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date(`${todayInputValue()}T00:00:00`) : date;
};

const startOfWeek = (value: string) => {
  const date = parseInputDate(value);
  date.setDate(date.getDate() - date.getDay());
  return date;
};

const endOfWeek = (value: string) => {
  const date = startOfWeek(value);
  date.setDate(date.getDate() + 6);
  return date;
};

const startOfMonth = (value: string) => {
  const date = parseInputDate(value);
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const endOfMonth = (value: string) => {
  const date = parseInputDate(value);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

const dateKey = (value: string) => toInputDate(parseInputDate(value));

const appointmentDateKey = (appointment: AppointmentResponse) => appointment.appointment_date.slice(0, 10);

const formatDayHeader = (value: string) =>
  new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', weekday: 'short' }).format(parseInputDate(value));

const formatMonthDay = (value: string) =>
  new Intl.DateTimeFormat('en', { day: 'numeric', weekday: 'short' }).format(parseInputDate(value));

const eventClass = (appointment: AppointmentResponse) => {
  if (appointment.status === 'CANCELLED' || appointment.status === 'NO_SHOW') return 'cancelled';
  if (appointment.visit_type === 'FOLLOW_UP') return 'follow-up';
  if (appointment.visit_type === 'PROCEDURE') return 'procedure';
  if (appointment.visit_type === 'EMERGENCY') return 'emergency';
  return '';
};

const buildDateRange = (mode: CalendarMode, selectedDate: string) => {
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
  const { search } = useAppLocation();
  const initialParams = new URLSearchParams(search);
  const [mode, setMode] = useState<CalendarMode>((initialParams.get('view') as CalendarMode | null) ?? 'week');
  const [calendarDate, setCalendarDate] = useState(initialParams.get('date') ?? todayInputValue());
  const [departmentFilter, setDepartmentFilter] = useState(initialParams.get('department_id') ?? '');
  const [doctorFilter, setDoctorFilter] = useState(initialParams.get('doctor_id') ?? '');
  const [statusFilter, setStatusFilter] = useState<ApiAppointmentStatus | ''>(
    (initialParams.get('status') as ApiAppointmentStatus | null) ?? '',
  );
  const [appointments, setAppointments] = useState<AppointmentResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const range = useMemo(() => buildDateRange(mode, calendarDate), [calendarDate, mode]);
  const visibleDoctors = useMemo(
    () => doctors.filter((doctor) => !departmentFilter || doctor.department_id === departmentFilter),
    [departmentFilter, doctors],
  );
  const weekDays = useMemo(() => buildWeekDays(calendarDate), [calendarDate]);
  const monthDays = useMemo(() => buildMonthDays(calendarDate), [calendarDate]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2800);
  };

  const loadLookups = useCallback(async () => {
    const [departmentResponse, doctorResponse] = await Promise.all([
      departmentsApi.list({ status: 'ACTIVE', limit: 100 }),
      doctorsApi.list({ status: 'ACTIVE', limit: 100, sortBy: 'display_name', sortOrder: 'asc' }),
    ]);
    setDepartments(departmentResponse.data);
    setDoctors(doctorResponse.data);
  }, []);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const response = await appointmentsApi.list({
        date_from: range.from,
        date_to: range.to,
        department_id: departmentFilter || undefined,
        doctor_id: doctorFilter || undefined,
        status: statusFilter || undefined,
        limit: 100,
        sortBy: 'start_time',
        sortOrder: 'asc',
      });
      setAppointments(response.data);
    } catch (error) {
      setAppointments([]);
      setLoadError(getAppointmentErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [departmentFilter, doctorFilter, range.from, range.to, statusFilter]);

  useEffect(() => {
    void loadLookups().catch((error) => setLoadError(getAppointmentErrorMessage(error)));
  }, [loadLookups]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('view', mode);
    if (calendarDate !== todayInputValue()) params.set('date', calendarDate);
    if (departmentFilter) params.set('department_id', departmentFilter);
    if (doctorFilter) params.set('doctor_id', doctorFilter);
    if (statusFilter) params.set('status', statusFilter);
    const nextUrl = `/appointments/calendar?${params.toString()}`;
    if (window.location.pathname + window.location.search !== nextUrl) {
      navigate(nextUrl, { replace: true });
    }
  }, [calendarDate, departmentFilter, doctorFilter, mode, statusFilter]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const appointmentsFor = (day: string, slot?: string) =>
    appointments.filter((appointment) => {
      const sameDay = appointmentDateKey(appointment) === day;
      return sameDay && (!slot || appointment.start_time.startsWith(slot.slice(0, 2)));
    });

  const handleExport = () => {
    downloadAppointments(appointments);
    showToast('Calendar export downloaded.');
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
            <select id="calendar-doctor" onChange={(event) => setDoctorFilter(event.target.value)} value={doctorFilter}>
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
                      {formatDayHeader(day)}
                    </span>
                  ))}
                </div>
                {timeSlots.map((slot) => (
                  <div className="appointment-calendar-row" key={slot}>
                    <div className="appointment-calendar-time">{slot}</div>
                    {(mode === 'day' ? [dateKey(calendarDate)] : weekDays).map((day) => (
                      <div className="appointment-calendar-cell" key={`${day}-${slot}`}>
                        {appointmentsFor(day, slot).map((appointment) => (
                          <button
                            className={`appointment-calendar-event ${eventClass(appointment)}`}
                            key={appointment.id}
                            onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(appointment.patient_id)}`)}
                            type="button"
                          >
                            <strong>
                              {appointment.start_time} - {appointment.patient_name}
                            </strong>
                            <span>
                              {appointment.doctor_name} - {appointmentVisitTypeLabels[appointment.visit_type]}
                            </span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!loading && mode === 'month' ? (
            <div className="calendar-scroll">
              <div className="appointment-month">
                {monthDays.map((day) => (
                  <div className={`appointment-month-day ${day === todayInputValue() ? 'today' : ''}`} key={day}>
                    <strong>{formatMonthDay(day)}</strong>
                    {appointmentsFor(day).slice(0, 4).map((appointment) => (
                      <button
                        className={`appointment-calendar-event ${eventClass(appointment)}`}
                        key={appointment.id}
                        onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(appointment.patient_id)}`)}
                        type="button"
                      >
                        <strong>
                          {appointment.start_time} - {appointment.patient_name}
                        </strong>
                        <span>{appointment.doctor_name}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <Toast message={toastMessage} visible={toastVisible} />
    </>
  );
}
