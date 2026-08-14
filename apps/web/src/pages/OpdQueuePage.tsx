import { useCallback, useEffect, useMemo, useState } from 'react';
import { appointmentsApi, type AppointmentResponse } from '../api/appointments';
import { departmentsApi, type DepartmentResponse } from '../api/departments';
import { doctorsApi, type DoctorResponse } from '../api/doctors';
import { opdApi, type ApiOpdVisitPriority, type ApiOpdVisitStatus, type OpdVisitResponse } from '../api/opd';
import { patientsApi, type PatientResponse } from '../api/patients';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { navigate, useAppLocation } from '../routing/navigation';
import {
  formatVisitDateTime,
  getOpdErrorMessage,
  isActiveVisit,
  opdVisitPriorityLabels,
  opdVisitStatusLabels,
  opdVisitTypeLabels,
  patientInitials,
  todayInputValue,
  visitPriorityClass,
  visitStatusClass,
} from './opd-utils';

type StatusFilter = ApiOpdVisitStatus | '';
type PriorityFilter = ApiOpdVisitPriority | '';

const appointmentEligibleStatuses = ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'SKIPPED'];

const waitMinutes = (visit: OpdVisitResponse, index: number) => {
  if (!isActiveVisit(visit)) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(visit.check_in_time).getTime()) / 60000) + index * 4);
};

const visitSort = (left: OpdVisitResponse, right: OpdVisitResponse) => {
  if (left.priority === 'EMERGENCY' && right.priority !== 'EMERGENCY') return -1;
  if (left.priority !== 'EMERGENCY' && right.priority === 'EMERGENCY') return 1;
  return new Date(left.check_in_time).getTime() - new Date(right.check_in_time).getTime();
};

export function OpdQueuePage() {
  const { search } = useAppLocation();
  const initialParams = new URLSearchParams(search);
  const [visits, setVisits] = useState<OpdVisitResponse[]>([]);
  const [appointments, setAppointments] = useState<AppointmentResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
  const [patients, setPatients] = useState<PatientResponse[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState(initialParams.get('department_id') ?? '');
  const [doctorFilter, setDoctorFilter] = useState(initialParams.get('doctor_id') ?? '');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>((initialParams.get('status') as ApiOpdVisitStatus | null) ?? '');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(
    (initialParams.get('priority') as ApiOpdVisitPriority | null) ?? '',
  );
  const [queueDate, setQueueDate] = useState(initialParams.get('date') ?? todayInputValue());
  const [searchTerm, setSearchTerm] = useState(initialParams.get('search') ?? '');
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInPatientId, setWalkInPatientId] = useState('');
  const [walkInDoctorId, setWalkInDoctorId] = useState('');
  const [walkInReason, setWalkInReason] = useState('');
  const [walkInError, setWalkInError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updating, setUpdating] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const [vitalsModalOpen, setVitalsModalOpen] = useState(false);
  const [vitalsVisit, setVitalsVisit] = useState<OpdVisitResponse | null>(null);
  const [vitalsForm, setVitalsForm] = useState({
    blood_pressure_systolic: '120',
    blood_pressure_diastolic: '80',
    weight_kg: '70',
    height_cm: '170',
    temperature_c: '36.8',
    pulse_bpm: '72',
    respiratory_rate_per_min: '16',
    oxygen_saturation_percent: '98',
    notes: '',
  });
  const [vitalsSubmitting, setVitalsSubmitting] = useState(false);
  const [vitalsError, setVitalsError] = useState('');
  const [vitalsFieldErrors, setVitalsFieldErrors] = useState<Record<string, string>>({});

  const openVitalsModal = (visit: OpdVisitResponse) => {
    setVitalsVisit(visit);
    setVitalsError('');
    setVitalsFieldErrors({});
    setVitalsModalOpen(true);
  };

  const saveVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vitalsVisit) return;

    const errors: Record<string, string> = {};
    if (!vitalsForm.blood_pressure_systolic.trim()) {
      errors.blood_pressure_systolic = 'Systolic BP is required.';
    }
    if (!vitalsForm.blood_pressure_diastolic.trim()) {
      errors.blood_pressure_diastolic = 'Diastolic BP is required.';
    }
    if (!vitalsForm.weight_kg.trim()) {
      errors.weight_kg = 'Weight is required.';
    }
    if (!vitalsForm.height_cm.trim()) {
      errors.height_cm = 'Height is required.';
    }

    if (Object.keys(errors).length > 0) {
      setVitalsFieldErrors(errors);
      return;
    }

    setVitalsFieldErrors({});
    setVitalsSubmitting(true);
    setVitalsError('');
    try {
      await opdApi.createVitals(vitalsVisit.id, {
        blood_pressure_systolic: Number(vitalsForm.blood_pressure_systolic) || 120,
        blood_pressure_diastolic: Number(vitalsForm.blood_pressure_diastolic) || 80,
        weight_kg: Number(vitalsForm.weight_kg) || 70,
        height_cm: Number(vitalsForm.height_cm) || 170,
        temperature_c: vitalsForm.temperature_c ? Number(vitalsForm.temperature_c) : null,
        pulse_bpm: vitalsForm.pulse_bpm ? Number(vitalsForm.pulse_bpm) : null,
        respiratory_rate_per_min: vitalsForm.respiratory_rate_per_min ? Number(vitalsForm.respiratory_rate_per_min) : null,
        oxygen_saturation_percent: vitalsForm.oxygen_saturation_percent ? Number(vitalsForm.oxygen_saturation_percent) : null,
        notes: vitalsForm.notes.trim() || null,
      });
      await opdApi.updateVisitStatus(vitalsVisit.id, { status: 'READY_FOR_CONSULTATION' }).catch(() => null);
      setVitalsModalOpen(false);
      setVitalsVisit(null);
      await loadQueue();
      showToast(`Vitals recorded for ${vitalsVisit.patient_name}`);
    } catch (err) {
      setVitalsError(getOpdErrorMessage(err));
    } finally {
      setVitalsSubmitting(false);
    }
  };

  const sortedVisits = useMemo(() => [...visits].sort(visitSort), [visits]);
  const activeVisits = sortedVisits.filter(isActiveVisit);
  const currentVisit = sortedVisits.find((visit) => visit.status === 'IN_CONSULTATION') ?? null;
  const nextVisit = sortedVisits.find((visit) => visit.status !== 'IN_CONSULTATION' && isActiveVisit(visit)) ?? null;
  const pendingAppointments = appointments.filter(
    (appointment) =>
      appointmentEligibleStatuses.includes(appointment.status) &&
      !visits.some((visit) => visit.appointment_id === appointment.id),
  );
  const averageWait =
    activeVisits.length === 0
      ? 0
      : Math.round(activeVisits.reduce((total, visit, index) => total + waitMinutes(visit, index), 0) / activeVisits.length);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 3000);
  };

  const loadLookups = useCallback(async () => {
    const [departmentResponse, doctorResponse, patientResponse] = await Promise.all([
      departmentsApi.list({ status: 'ACTIVE', limit: 100 }),
      doctorsApi.list({ status: 'ACTIVE', limit: 100, sortBy: 'display_name', sortOrder: 'asc' }),
      patientsApi.list({ status: 'ACTIVE', limit: 50, sortBy: 'created_at', sortOrder: 'desc' }),
    ]);
    setDepartments(departmentResponse.data);
    setDoctors(doctorResponse.data);
    setPatients(patientResponse.data);
    setWalkInPatientId((current) => current || patientResponse.data[0]?.id || '');
    setWalkInDoctorId((current) => current || doctorResponse.data[0]?.id || '');
  }, []);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [visitResponse, appointmentResponse] = await Promise.all([
        opdApi.listVisits({
          search: searchTerm.trim() || undefined,
          status: statusFilter || undefined,
          doctor_id: doctorFilter || undefined,
          department_id: departmentFilter || undefined,
          date_from: queueDate,
          date_to: queueDate,
          limit: 100,
          sortBy: 'check_in_time',
          sortOrder: 'asc',
        }),
        appointmentsApi.list({
          search: searchTerm.trim() || undefined,
          doctor_id: doctorFilter || undefined,
          department_id: departmentFilter || undefined,
          date_from: queueDate,
          date_to: queueDate,
          limit: 100,
          sortBy: 'start_time',
          sortOrder: 'asc',
        }),
      ]);
      setVisits(visitResponse.data.filter((visit) => !priorityFilter || visit.priority === priorityFilter));
      setAppointments(appointmentResponse.data);
    } catch (error) {
      setVisits([]);
      setAppointments([]);
      setLoadError(getOpdErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [departmentFilter, doctorFilter, priorityFilter, queueDate, searchTerm, statusFilter]);

  useEffect(() => {
    void loadLookups().catch((error) => setLoadError(getOpdErrorMessage(error)));
  }, [loadLookups]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    if (departmentFilter) params.set('department_id', departmentFilter);
    if (doctorFilter) params.set('doctor_id', doctorFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (priorityFilter) params.set('priority', priorityFilter);
    if (queueDate !== todayInputValue()) params.set('date', queueDate);
    const query = params.toString();
    const nextUrl = `/opd/queue${query ? `?${query}` : ''}`;
    if (window.location.pathname + window.location.search !== nextUrl) {
      navigate(nextUrl, { replace: true });
    }
  }, [departmentFilter, doctorFilter, priorityFilter, queueDate, searchTerm, statusFilter]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const createVisitFromAppointment = async (appointment: AppointmentResponse) => {
    setUpdating(appointment.id);
    try {
      await opdApi.createVisit({
        appointment_id: appointment.id,
        notes: 'Patient checked in from appointment queue.',
      });
      await loadQueue();
      showToast(`${appointment.patient_name} checked in to OPD.`);
    } catch (error) {
      showToast(getOpdErrorMessage(error));
    } finally {
      setUpdating('');
    }
  };

  const updateVisitStatus = async (visit: OpdVisitResponse, status: ApiOpdVisitStatus, notes?: string) => {
    setUpdating(visit.id);
    try {
      await opdApi.updateVisitStatus(visit.id, { status, notes });
      await loadQueue();
      showToast(`${visit.visit_number} moved to ${opdVisitStatusLabels[status].toLowerCase()}.`);
    } catch (error) {
      showToast(getOpdErrorMessage(error));
    } finally {
      setUpdating('');
    }
  };

  const submitWalkIn = async () => {
    if (!walkInPatientId) {
      setWalkInError('Patient is required for walk-in check-in.');
      return;
    }
    if (!walkInDoctorId) {
      setWalkInError('Doctor is required for walk-in check-in.');
      return;
    }

    setUpdating('walk-in');
    try {
      await opdApi.createVisit({
        doctor_id: walkInDoctorId,
        patient_id: walkInPatientId,
        priority: 'ROUTINE',
        reason: walkInReason.trim() || null,
        visit_type: 'WALK_IN',
      });
      setWalkInOpen(false);
      setWalkInReason('');
      await loadQueue();
      showToast('Walk-in patient checked in to OPD.');
    } catch (error) {
      setWalkInError(getOpdErrorMessage(error));
    } finally {
      setUpdating('');
    }
  };

  return (
    <>
      <div className="opd-page">
        <section className="opd-page-header">
          <div className="opd-page-title">
            {/* <h2>OPD Waiting Queue</h2>
            <p>Coordinate check-in, active visits and consultation readiness</p> */}
          </div>
          <div className="opd-page-actions">
            <button className="doc-btn" onClick={loadQueue} type="button">
              <i className="ph ph-arrow-clockwise" aria-hidden="true" />
              Refresh Queue
            </button>
            <button className="doc-btn primary" onClick={() => setWalkInOpen(true)} type="button">
              <i className="ph ph-person-simple-walk" aria-hidden="true" />
              Walk-in Check-in
            </button>
          </div>
        </section>

        <section className="doc-kpi-grid opd-kpi-grid">
          {([
            ['ph-users-three', 'orange', 'Waiting / Vitals', activeVisits.filter((visit) => visit.status !== 'IN_CONSULTATION').length, 'Active queue'],
            ['ph-stethoscope', 'cyan', 'In Consultation', sortedVisits.filter((visit) => visit.status === 'IN_CONSULTATION').length, 'Doctor active'],
            ['ph-calendar-check', 'blue', 'Pending Check-ins', pendingAppointments.length, 'Appointments without OPD visit'],
            ['ph-check-circle', 'green', 'Completed', sortedVisits.filter((visit) => visit.status === 'COMPLETED').length, 'Today'],
            ['ph-timer', 'purple', 'Average Wait', `${averageWait} min`, 'Live estimate'],
          ] as const).map(([icon, tone, label, value, copy]) => (
            <article className="doc-kpi" key={label}>
              <span className={`doc-kpi-icon ${tone}`}>
                <i className={`ph ${icon}`} aria-hidden="true" />
              </span>
              <div className="doc-kpi-copy">
                <span>{label}</span>
                <strong>{loading ? '-' : value}</strong>
                <small>{copy}</small>
              </div>
            </article>
          ))}
        </section>

        <section className="doc-toolbar" id="opd-queue-filters">
          <div className="doc-field grow doc-search">
            <label htmlFor="opd-search">Search OPD Queue</label>
            <i className="ph ph-magnifying-glass" aria-hidden="true" />
            <input
              id="opd-search"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search visit, MRN, patient, doctor, or specialty"
              type="search"
              value={searchTerm}
            />
          </div>
          <div className="doc-field">
            <label htmlFor="opd-department">Department</label>
            <select id="opd-department" onChange={(event) => setDepartmentFilter(event.target.value)} value={departmentFilter}>
              <option value="">All Departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
          <div className="doc-field">
            <label htmlFor="opd-doctor">Doctor</label>
            <select id="opd-doctor" onChange={(event) => setDoctorFilter(event.target.value)} value={doctorFilter}>
              <option value="">All Doctors</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.display_name}
                </option>
              ))}
            </select>
          </div>
          <div className="doc-field">
            <label htmlFor="opd-status">Status</label>
            <select id="opd-status" onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} value={statusFilter}>
              <option value="">All Statuses</option>
              {Object.entries(opdVisitStatusLabels).map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="doc-field">
            <label htmlFor="opd-priority">Priority</label>
            <select
              id="opd-priority"
              onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
              value={priorityFilter}
            >
              <option value="">All Priorities</option>
              {Object.entries(opdVisitPriorityLabels).map(([priority, label]) => (
                <option key={priority} value={priority}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="doc-field">
            <label htmlFor="opd-date">Date</label>
            <input id="opd-date" onChange={(event) => setQueueDate(event.target.value)} type="date" value={queueDate} />
          </div>
        </section>

        {loadError ? <div className="form-error-banner">{loadError}</div> : null}

        <section className="opd-queue-layout">
          <div className="doc-card">
            <div className="doc-card-header">
              <div>
                <h3>Active OPD Visits</h3>
                <p>{loading ? 'Loading queue...' : `${sortedVisits.length} visits found`}</p>
              </div>
            </div>

            <div className="doc-table-wrap appointment-queue-table-wrap">
              <table className="doc-table">
                <colgroup>
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '23%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Patient &amp; Visit</th>
                    <th>Doctor</th>
                    <th>Wait</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="um-state-cell" colSpan={5}>
                        Loading OPD queue...
                      </td>
                    </tr>
                  ) : sortedVisits.length === 0 ? (
                    <tr>
                      <td className="um-state-cell" colSpan={5}>
                        No OPD visits found. Check in an appointment or register a walk-in to start the queue.
                      </td>
                    </tr>
                  ) : (
                    sortedVisits.map((visit, index) => (
                      <tr className={visit.id === currentVisit?.id ? 'queue-current-row' : ''} key={visit.id}>
                        <td>
                          <div className="doc-person">
                            <span className="doc-avatar">{patientInitials(visit.patient_name)}</span>
                            <div>
                              <strong>{visit.patient_name}</strong>
                              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>{visit.visit_number}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong>{visit.doctor_name}</strong>
                          <br />
                          <small style={{ color: '#64748b' }}>{visit.doctor_specialization}</small>
                        </td>
                        <td>
                          <strong>{waitMinutes(visit, index)} m</strong>
                          <br />
                          <span className={`doc-status ${visitPriorityClass(visit.priority)}`} style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem' }}>
                            {opdVisitPriorityLabels[visit.priority]}
                          </span>
                        </td>
                        <td>
                          <span className={`doc-status ${visitStatusClass(visit.status)}`}>
                            {opdVisitStatusLabels[visit.status]}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                            {visit.status === 'WAITING_FOR_VITALS' || visit.status === 'CHECKED_IN' ? (
                              <button
                                className="doc-btn primary compact"
                                disabled={updating === visit.id}
                                onClick={() => openVitalsModal(visit)}
                                title="Step 1: Take Vitals"
                                type="button"
                              >
                                <i className="ph ph-heartbeat" aria-hidden="true" />
                                Take Vitals
                              </button>
                            ) : visit.status === 'READY_FOR_CONSULTATION' ? (
                              <button
                                className="doc-btn success compact"
                                disabled={updating === visit.id}
                                onClick={async () => {
                                  await opdApi.updateVisitStatus(visit.id, { status: 'IN_CONSULTATION' }).catch(() => null);
                                  navigate(`/opd/consultation?id=${encodeURIComponent(visit.id)}`);
                                }}
                                title="Step 2: Start Consultation"
                                type="button"
                              >
                                <i className="ph ph-stethoscope" aria-hidden="true" />
                                Start Consultation
                              </button>
                            ) : visit.status === 'IN_CONSULTATION' ? (
                              <button
                                className="doc-btn primary compact"
                                onClick={() => navigate(`/opd/consultation?id=${encodeURIComponent(visit.id)}`)}
                                title="Resume Consultation"
                                type="button"
                              >
                                <i className="ph ph-arrow-square-out" aria-hidden="true" />
                                Consultation
                              </button>
                            ) : (
                              <span className="doc-status completed">
                                <i className="ph ph-check-circle" aria-hidden="true" /> Completed
                              </span>
                            )}
                            <button
                              className="doc-action"
                              onClick={() => navigate(`/opd/visit?id=${encodeURIComponent(visit.id)}`)}
                              title="View Visit Details"
                              type="button"
                            >
                              <i className="ph ph-arrow-square-out" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="doc-card opd-queue-panel">
            <div className="doc-card-header">
              <div>
                <h3>Check-in Summary</h3>
                <p>Appointment to OPD handoff</p>
              </div>
            </div>
            <div className="opd-token-display">
              <span>Current Visit</span>
              <strong>{currentVisit?.visit_number ?? '-'}</strong>
              <p>{currentVisit?.patient_name ?? 'No patient in consultation'}</p>
            </div>
            <div className="opd-queue-stats">
              <div className="opd-queue-stat">
                <span>Next Visit</span>
                <strong>{nextVisit?.visit_number ?? '-'}</strong>
              </div>
              <div className="opd-queue-stat">
                <span>Average Wait</span>
                <strong>{averageWait} min</strong>
              </div>
              <div className="opd-queue-stat">
                <span>Pending Check-ins</span>
                <strong>{pendingAppointments.length}</strong>
              </div>
              <div className="opd-queue-stat">
                <span>Active Visits</span>
                <strong>{activeVisits.length}</strong>
              </div>
            </div>

            <div className="opd-pending-list">
              <h4>Pending Appointment Check-ins</h4>
              {pendingAppointments.length === 0 ? (
                <p>No eligible appointments are waiting for OPD check-in.</p>
              ) : (
                pendingAppointments.slice(0, 5).map((appointment) => (
                  <div className="opd-pending-item" key={appointment.id}>
                    <div>
                      <strong>{appointment.patient_name}</strong>
                      <span>
                        {appointment.start_time} - {appointment.doctor_name}
                      </span>
                    </div>
                    <button
                      className="doc-btn"
                      disabled={updating === appointment.id}
                      onClick={() => createVisitFromAppointment(appointment)}
                      type="button"
                    >
                      Check in
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>
        </section>
      </div>

      <Modal onClose={() => setWalkInOpen(false)} open={walkInOpen} size="large" title="Walk-in Check-in">
        <form className="modal-form doctor-onboarding-form" onSubmit={(e) => { e.preventDefault(); void submitWalkIn(); }}>
          {walkInError ? <div className="form-error-banner" role="alert">{walkInError}</div> : null}

          <section className="doctor-onboarding-section">
            <header>
              <span><i className="ph ph-user-plus" aria-hidden="true" /></span>
              <div>
                <h3>Walk-in Visit Details</h3>
                <p>Register an unscheduled OPD visit for an active patient.</p>
              </div>
            </header>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="walk-in-patient">
                  Patient <span className="required-asterisk">*</span>
                </label>
                <select id="walk-in-patient" onChange={(e) => setWalkInPatientId(e.target.value)} required value={walkInPatientId}>
                  <option value="">Select patient</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.patient_number} - {patient.first_name} {patient.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="walk-in-doctor">
                  Doctor <span className="required-asterisk">*</span>
                </label>
                <select id="walk-in-doctor" onChange={(e) => setWalkInDoctorId(e.target.value)} required value={walkInDoctorId}>
                  <option value="">Select doctor</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.display_name} - {doctor.specialization}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group full-width">
                <label htmlFor="walk-in-reason">Reason for Visit</label>
                <textarea
                  id="walk-in-reason"
                  onChange={(e) => setWalkInReason(e.target.value)}
                  placeholder="Presenting reason for walk-in visit"
                  rows={3}
                  value={walkInReason}
                />
              </div>
            </div>
          </section>

          <div className="modal-actions">
            <button className="secondary-action" onClick={() => setWalkInOpen(false)} type="button">
              Cancel
            </button>
            <button className="primary-action" disabled={updating === 'walk-in'} type="submit">
              {updating === 'walk-in' ? 'Checking in...' : 'Check in'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Patient Vitals Modal */}
      <Modal
        footer={
          <>
            <button className="secondary-action" onClick={() => setVitalsModalOpen(false)} type="button">
              Cancel
            </button>
            <button className="primary-action" disabled={vitalsSubmitting} onClick={(e) => void saveVitals(e)} type="button">
              {vitalsSubmitting ? 'Saving...' : 'Save Vitals'}
            </button>
          </>
        }
        icon="ph-heartbeat"
        onClose={() => setVitalsModalOpen(false)}
        open={vitalsModalOpen}
        title={`Record Vitals - ${vitalsVisit?.patient_name ?? ''}`}
      >
        <form onSubmit={saveVitals}>
          {vitalsError ? <div className="form-error-banner">{vitalsError}</div> : null}
          <div className="walk-in-form-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <div className={`form-group${vitalsFieldErrors.blood_pressure_systolic ? ' has-error' : ''}`}>
              <label htmlFor="sys-bp">
                Systolic BP (mmHg) <span className="required-asterisk">*</span>
              </label>
              <input
                id="sys-bp"
                onChange={(e) => {
                  setVitalsForm({ ...vitalsForm, blood_pressure_systolic: e.target.value });
                  setVitalsFieldErrors((prev) => ({ ...prev, blood_pressure_systolic: '' }));
                }}
                required
                type="number"
                value={vitalsForm.blood_pressure_systolic}
              />
              {vitalsFieldErrors.blood_pressure_systolic ? (
                <span className="field-error-msg">
                  <i className="ph ph-warning-circle" aria-hidden="true" />
                  {vitalsFieldErrors.blood_pressure_systolic}
                </span>
              ) : null}
            </div>
            <div className={`form-group${vitalsFieldErrors.blood_pressure_diastolic ? ' has-error' : ''}`}>
              <label htmlFor="dia-bp">
                Diastolic BP (mmHg) <span className="required-asterisk">*</span>
              </label>
              <input
                id="dia-bp"
                onChange={(e) => {
                  setVitalsForm({ ...vitalsForm, blood_pressure_diastolic: e.target.value });
                  setVitalsFieldErrors((prev) => ({ ...prev, blood_pressure_diastolic: '' }));
                }}
                required
                type="number"
                value={vitalsForm.blood_pressure_diastolic}
              />
              {vitalsFieldErrors.blood_pressure_diastolic ? (
                <span className="field-error-msg">
                  <i className="ph ph-warning-circle" aria-hidden="true" />
                  {vitalsFieldErrors.blood_pressure_diastolic}
                </span>
              ) : null}
            </div>
            <div className="form-group">
              <label htmlFor="pulse">Pulse Rate (bpm)</label>
              <input
                id="pulse"
                onChange={(e) => setVitalsForm({ ...vitalsForm, pulse_bpm: e.target.value })}
                type="number"
                value={vitalsForm.pulse_bpm}
              />
            </div>
            <div className="form-group">
              <label htmlFor="temp">Temperature (°C)</label>
              <input
                id="temp"
                onChange={(e) => setVitalsForm({ ...vitalsForm, temperature_c: e.target.value })}
                step="0.1"
                type="number"
                value={vitalsForm.temperature_c}
              />
            </div>
            <div className="form-group">
              <label htmlFor="spo2">SpO₂ (%)</label>
              <input
                id="spo2"
                onChange={(e) => setVitalsForm({ ...vitalsForm, oxygen_saturation_percent: e.target.value })}
                type="number"
                value={vitalsForm.oxygen_saturation_percent}
              />
            </div>
            <div className="form-group">
              <label htmlFor="resp">Resp. Rate (min)</label>
              <input
                id="resp"
                onChange={(e) => setVitalsForm({ ...vitalsForm, respiratory_rate_per_min: e.target.value })}
                type="number"
                value={vitalsForm.respiratory_rate_per_min}
              />
            </div>
            <div className={`form-group${vitalsFieldErrors.weight_kg ? ' has-error' : ''}`}>
              <label htmlFor="weight">
                Weight (kg) <span className="required-asterisk">*</span>
              </label>
              <input
                id="weight"
                onChange={(e) => {
                  setVitalsForm({ ...vitalsForm, weight_kg: e.target.value });
                  setVitalsFieldErrors((prev) => ({ ...prev, weight_kg: '' }));
                }}
                required
                type="number"
                value={vitalsForm.weight_kg}
              />
              {vitalsFieldErrors.weight_kg ? (
                <span className="field-error-msg">
                  <i className="ph ph-warning-circle" aria-hidden="true" />
                  {vitalsFieldErrors.weight_kg}
                </span>
              ) : null}
            </div>
            <div className={`form-group${vitalsFieldErrors.height_cm ? ' has-error' : ''}`}>
              <label htmlFor="height">
                Height (cm) <span className="required-asterisk">*</span>
              </label>
              <input
                id="height"
                onChange={(e) => {
                  setVitalsForm({ ...vitalsForm, height_cm: e.target.value });
                  setVitalsFieldErrors((prev) => ({ ...prev, height_cm: '' }));
                }}
                required
                type="number"
                value={vitalsForm.height_cm}
              />
              {vitalsFieldErrors.height_cm ? (
                <span className="field-error-msg">
                  <i className="ph ph-warning-circle" aria-hidden="true" />
                  {vitalsFieldErrors.height_cm}
                </span>
              ) : null}
            </div>
          </div>
        </form>
      </Modal>

      <Toast message={toastMessage} visible={toastVisible} />
    </>
  );
}
