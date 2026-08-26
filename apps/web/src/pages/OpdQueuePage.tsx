import { useMemo, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type AppointmentResponse } from '../api/appointments';
import { type ApiOpdVisitPriority, type ApiOpdVisitStatus, type OpdVisitResponse } from '../api/opd';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import {
  ClinicalVitalCard,
  calculateBmi,
  calculateMap,
  evaluateDiastolicBp,
  evaluatePulse,
  evaluateRespiratoryRate,
  evaluateSpo2,
  evaluateSystolicBp,
  evaluateTemperature,
} from '../components/ui/ClinicalVitalCard';
import { navigate, useAppLocation } from '../routing/navigation';
import {
  getOpdErrorMessage,
  isActiveVisit,
  opdVisitPriorityLabels,
  opdVisitStatusLabels,
  patientInitials,
  todayInputValue,
  visitPriorityClass,
  visitStatusClass,
} from './opd-utils';
import { useOpdQueue, type OpdQueueFilters } from '../hooks/opd/useOpdQueue';

const appointmentEligibleStatuses = ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'SKIPPED'];

const tokenFor = (visit: OpdVisitResponse, index: number) =>
  `${visit.priority === 'EMERGENCY' ? 'E' : visit.priority === 'URGENT' ? 'U' : 'O'}${String(index + 1).padStart(3, '0')}`;

const waitMinutes = (visit: OpdVisitResponse, index: number) => {
  if (!isActiveVisit(visit)) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(visit.check_in_time).getTime()) / 60000) + index * 4);
};

const visitSort = (left: OpdVisitResponse, right: OpdVisitResponse) => {
  if (left.status === 'SKIPPED' && right.status !== 'SKIPPED') return 1;
  if (left.status !== 'SKIPPED' && right.status === 'SKIPPED') return -1;
  if (left.priority === 'EMERGENCY' && right.priority !== 'EMERGENCY') return -1;
  if (left.priority !== 'EMERGENCY' && right.priority === 'EMERGENCY') return 1;
  return new Date(left.check_in_time).getTime() - new Date(right.check_in_time).getTime();
};

const vitalsSchema = z.object({
  blood_pressure_systolic: z.string().optional(),
  blood_pressure_diastolic: z.string().optional(),
  weight_kg: z.string().optional(),
  height_cm: z.string().optional(),
  temperature_c: z.string().optional(),
  pulse_bpm: z.string().optional(),
  respiratory_rate_per_min: z.string().optional(),
  oxygen_saturation_percent: z.string().optional(),
  notes: z.string().optional(),
}).refine(data => {
  if ((data.blood_pressure_systolic && !data.blood_pressure_diastolic) || (!data.blood_pressure_systolic && data.blood_pressure_diastolic)) {
    return false;
  }
  return true;
}, {
  message: "Both systolic and diastolic BP must be provided together",
  path: ["blood_pressure_systolic"]
});

type VitalsForm = z.infer<typeof vitalsSchema>;

const walkInSchema = z.object({
  patient_id: z.string().min(1, "Patient is required"),
  doctor_id: z.string().min(1, "Doctor is required"),
  reason: z.string().optional(),
});

type WalkInForm = z.infer<typeof walkInSchema>;

type StatusFilter = ApiOpdVisitStatus | '';
type PriorityFilter = ApiOpdVisitPriority | '';


const isStatusFilter = (val: string | null): val is ApiOpdVisitStatus =>
  val !== null && ['CHECKED_IN', 'WAITING_FOR_VITALS', 'READY_FOR_CONSULTATION', 'IN_CONSULTATION', 'SKIPPED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(val);

const isPriorityFilter = (val: string | null): val is ApiOpdVisitPriority =>
  val !== null && ['ROUTINE', 'URGENT', 'EMERGENCY'].includes(val);

export function OpdQueuePage() {

  const { search } = useAppLocation();
  const initialParams = new URLSearchParams(search);

  const [filters, setFilters] = useState<OpdQueueFilters>({
    search: initialParams.get('search') ?? '',
    department_id: initialParams.get('department_id') ?? '',
    doctor_id: initialParams.get('doctor_id') ?? '',
    status: isStatusFilter(initialParams.get('status')) ? (initialParams.get('status') as ApiOpdVisitStatus) : '',
    priority: isPriorityFilter(initialParams.get('priority')) ? (initialParams.get('priority') as ApiOpdVisitPriority) : '',
    date: initialParams.get('date') ?? todayInputValue(),
  });

  const {
    visits,
    appointments,
    doctors,
    departments,
    patients,
    isLoading,
    error,
    isUpdating,
    createVisit,
    updateVisitStatus,
    createVitals,
    canCreateVisit,
    canEditVisit,
    canCreateVitals,
  } = useOpdQueue(filters);

  const [walkInOpen, setWalkInOpen] = useState(false);
  const [vitalsModalOpen, setVitalsModalOpen] = useState(false);
  const [vitalsVisit, setVitalsVisit] = useState<OpdVisitResponse | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');
  const [toastVisible, setToastVisible] = useState(false);
  const [actionError, setActionError] = useState('');

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastTone(tone);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 3500);
  };

  const {
    
    handleSubmit: handleVitalsSubmit,
    reset: resetVitals,
    watch: watchVitals,
    setValue: setValueVitals,
    formState: { errors: actionErrors, isSubmitting: vitalsSubmitting }
  } = useForm<VitalsForm>({
    resolver: zodResolver(vitalsSchema),
    defaultValues: {
  const [vitalsModalOpen, setVitalsModalOpen] = useState(false);
  const [vitalsVisit, setVitalsVisit] = useState<OpdVisitResponse | null>(null);
  const [vitalsForm, setVitalsForm] = useState({
    blood_pressure_systolic: '',
    blood_pressure_diastolic: '',
    weight_kg: '',
    height_cm: '',
    temperature_c: '',
    pulse_bpm: '',
    respiratory_rate_per_min: '',
    oxygen_saturation_percent: '',
    notes: '',
  });
  const [vitalsSubmitting, setVitalsSubmitting] = useState(false);
  const [vitalsError, setVitalsError] = useState('');


  const openVitalsModal = (visit: OpdVisitResponse) => {
    setVitalsVisit(visit);
    setVitalsForm({
      blood_pressure_systolic: '',
      blood_pressure_diastolic: '',
      weight_kg: '',
      height_cm: '',
      temperature_c: '',
      pulse_bpm: '',
      respiratory_rate_per_min: '',
      oxygen_saturation_percent: '',
      notes: '',
    });
    setVitalsError('');
    setVitalsModalOpen(true);
  };

  const saveVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vitalsVisit) return;

    setVitalsSubmitting(true);
    setVitalsError('');
    try {
      await opdApi.createVitals(vitalsVisit.id, {
        blood_pressure_systolic: vitalsForm.blood_pressure_systolic.trim() ? Number(vitalsForm.blood_pressure_systolic) : null,
        blood_pressure_diastolic: vitalsForm.blood_pressure_diastolic.trim() ? Number(vitalsForm.blood_pressure_diastolic) : null,
        weight_kg: vitalsForm.weight_kg.trim() ? Number(vitalsForm.weight_kg) : null,
        height_cm: vitalsForm.height_cm.trim() ? Number(vitalsForm.height_cm) : null,
        temperature_c: vitalsForm.temperature_c.trim() ? Number(vitalsForm.temperature_c) : null,
        pulse_bpm: vitalsForm.pulse_bpm.trim() ? Number(vitalsForm.pulse_bpm) : null,
        respiratory_rate_per_min: vitalsForm.respiratory_rate_per_min.trim() ? Number(vitalsForm.respiratory_rate_per_min) : null,
        oxygen_saturation_percent: vitalsForm.oxygen_saturation_percent.trim() ? Number(vitalsForm.oxygen_saturation_percent) : null,
        notes: vitalsForm.notes.trim() || null,
      });
      await opdApi.updateVisitStatus(vitalsVisit.id, { status: 'READY_FOR_CONSULTATION' }).catch(() => null);
      setVitalsModalOpen(false);
      setVitalsVisit(null);
      await loadQueue();
      showToast(`Vitals recorded for ${vitalsVisit.patient_name}`, 'success');
    } catch (err) {
      const errorMsg = getOpdErrorMessage(err);
      setVitalsError('');
      showToast(errorMsg, 'error');
    } finally {
      setVitalsSubmitting(false);
    }
  });

  const {
    register: registerWalkIn,
    handleSubmit: handleWalkInSubmit,
    reset: resetWalkIn,
    formState: { errors: walkInErrors }
  } = useForm<WalkInForm>({
    resolver: zodResolver(walkInSchema),
    defaultValues: {
      patient_id: '',
      doctor_id: '',
      reason: '',
    }
  });

  useEffect(() => {
    if (patients.length > 0 && doctors.length > 0) {
      resetWalkIn({
        patient_id: patients[0]?.id ?? "",
        doctor_id: doctors[0]?.id ?? "",
        reason: '',
      });
    }
  }, [patients, doctors, resetWalkIn]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.search?.trim()) params.set('search', filters.search.trim());
    if (filters.department_id) params.set('department_id', filters.department_id);
    if (filters.doctor_id) params.set('doctor_id', filters.doctor_id);
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.date !== todayInputValue()) params.set('date', filters.date);
    const query = params.toString();
    const nextUrl = `/opd/queue${query ? `?${query}` : ''}`;
    if (window.location.pathname + window.location.search !== nextUrl) {
      navigate(nextUrl, { replace: true });
    }
  }, [filters]);

  const sortedVisits = useMemo(() => [...visits].sort(visitSort), [visits]);
  const activeVisits = sortedVisits.filter(isActiveVisit);
  const currentVisit = sortedVisits.find((visit) => visit.status === 'IN_CONSULTATION') ?? null;
  const nextVisit = sortedVisits.find((visit) => visit.status !== 'IN_CONSULTATION' && isActiveVisit(visit)) ?? null;

  const currentIndex = currentVisit ? sortedVisits.findIndex((v) => v.id === currentVisit.id) : -1;
  const nextIndex = nextVisit ? sortedVisits.findIndex((v) => v.id === nextVisit.id) : -1;
  const pendingAppointments = appointments.filter(
    (appointment) =>
      appointmentEligibleStatuses.includes(appointment.status) &&
      !visits.some((visit) => visit.appointment_id === appointment.id),
  );
  const averageWait =
    activeVisits.length === 0
      ? 0
      : Math.round(activeVisits.reduce((total, visit, index) => total + waitMinutes(visit, index), 0) / activeVisits.length);

  const onVitalsSubmit = async (data: VitalsForm) => {
    if (!canCreateVitals || !canEditVisit) return;
    if (!vitalsVisit) return;
    setActionError('');
    try {
      await createVitals({
        visitId: vitalsVisit.id,
        payload: {
          blood_pressure_systolic: data.blood_pressure_systolic?.trim() ? Number(data.blood_pressure_systolic) : null,
          blood_pressure_diastolic: data.blood_pressure_diastolic?.trim() ? Number(data.blood_pressure_diastolic) : null,
          weight_kg: data.weight_kg?.trim() ? Number(data.weight_kg) : null,
          height_cm: data.height_cm?.trim() ? Number(data.height_cm) : null,
          temperature_c: data.temperature_c?.trim() ? Number(data.temperature_c) : null,
          pulse_bpm: data.pulse_bpm?.trim() ? Number(data.pulse_bpm) : null,
          respiratory_rate_per_min: data.respiratory_rate_per_min?.trim() ? Number(data.respiratory_rate_per_min) : null,
          oxygen_saturation_percent: data.oxygen_saturation_percent?.trim() ? Number(data.oxygen_saturation_percent) : null,
          notes: data.notes?.trim() || null,
        }
      });
      await updateVisitStatus({ id: vitalsVisit.id, payload: { status: 'READY_FOR_CONSULTATION' } });
      setVitalsModalOpen(false);
      setVitalsVisit(null);
      showToast(`Vitals recorded for ${vitalsVisit.patient_name}`, 'success');
    } catch (err) {
      setActionError(getOpdErrorMessage(err));
    }
  };

  const onWalkInSubmit = async (data: WalkInForm) => {
    if (!canCreateVisit) return;
    setActionError('');
    try {
      await createVisit({
        doctor_id: data.doctor_id,
        patient_id: data.patient_id,
        priority: 'ROUTINE',
        reason: data.reason?.trim() || null,
        visit_type: 'WALK_IN',
      });
      setWalkInOpen(false);
      resetWalkIn();
      showToast('Walk-in patient checked in to OPD.');
    } catch (err) {
      setActionError(getOpdErrorMessage(err));
    }
  };

  const createVisitFromAppointment = async (appointment: AppointmentResponse) => {
    if (!canCreateVisit) return;
    try {
      await createVisit({
        appointment_id: appointment.id,
        notes: 'Patient checked in from appointment queue.',
      });
      showToast(`${appointment.patient_name} checked in to OPD.`);
    } catch (err) {
      showToast(getOpdErrorMessage(err), 'error');
    }
  };

  const handleStatusChange = async (visit: OpdVisitResponse, status: ApiOpdVisitStatus, notes?: string) => {
    if (!canEditVisit) return;
    try {
      await updateVisitStatus({ id: visit.id, payload: { status, notes } });
      showToast(`${visit.visit_number} moved to ${opdVisitStatusLabels[status].toLowerCase()}.`);
    } catch (err) {
      showToast(getOpdErrorMessage(err), 'error');
    }
  };

  const handleCallNext = async () => {
    if (!canEditVisit) return;
    if (currentVisit) {
      showToast('Complete or skip the current patient first.', 'error');
      return;
    }
    if (!nextVisit) {
      showToast('No waiting patient is available in the queue.', 'error');
      return;
    }
    try {
      await updateVisitStatus({ id: nextVisit.id, payload: { status: 'IN_CONSULTATION' } });
      navigate(`/opd/consultation?id=${encodeURIComponent(nextVisit.id)}`);
    } catch (err) {
      showToast(getOpdErrorMessage(err), 'error');
    }
  };

  const bmiObj = calculateBmi(watchVitals('weight_kg') || '', watchVitals('height_cm') || '');
  const mapVal = calculateMap(watchVitals('blood_pressure_systolic') || '', watchVitals('blood_pressure_diastolic') || '');

  return (
    <>
      <div className="opd-page">
        <section className="opd-page-header">
          <div className="opd-page-title">
            {/* <h2>OPD Waiting Queue</h2>
            <p>Coordinate check-in, active visits and consultation readiness</p> */}
          </div>
          <div className="opd-page-actions">
            <button className="doc-btn" onClick={() => window.location.reload()} type="button">
              <i className="ph ph-arrow-clockwise" aria-hidden="true" />
              Refresh Queue
            </button>
            {/* <button className="doc-btn primary" onClick={() => setWalkInOpen(true)} type="button">
              <i className="ph ph-person-simple-walk" aria-hidden="true" />
              Walk-in Check-in
            </button> */}
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
                <strong>{isLoading ? '-' : value}</strong>
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
              onChange={(event) => setFilters(prev => ({ ...prev, search: event.target.value }))}
              placeholder="Search visit, MRN, patient, doctor, or specialty"
              type="search"
              value={filters.search}
            />
          </div>
          <div className="doc-field">
            <label htmlFor="opd-department">Department</label>
            <select id="opd-department" onChange={(event) => setFilters(prev => ({ ...prev, department_id: event.target.value }))} value={filters.department_id}>
              <option value="">All Departments</option>
              {departments.map((department: import('../api/departments').DepartmentResponse) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
          <div className="doc-field">
            <label htmlFor="opd-doctor">Doctor</label>
            <select id="opd-doctor" onChange={(event) => setFilters(prev => ({ ...prev, doctor_id: event.target.value }))} value={filters.doctor_id}>
              <option value="">All Doctors</option>
              {doctors.map((doctor: import('../api/doctors').DoctorResponse) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.display_name}
                </option>
              ))}
            </select>
          </div>
          <div className="doc-field">
            <label htmlFor="opd-status">Status</label>
            <select id="opd-status" onChange={(event) => setFilters(prev => ({ ...prev, status: event.target.value as StatusFilter }))} value={filters.status}>
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
              onChange={(event) => setFilters(prev => ({ ...prev, priority: event.target.value as PriorityFilter }))}
              value={filters.priority}
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
            <input id="opd-date" onChange={(event) => setFilters(prev => ({ ...prev, date: event.target.value }))} type="date" value={filters.date} />
          </div>
        </section>

        {error ? <div className="form-error-banner">{getOpdErrorMessage(error)}</div> : null}

        <section className="opd-queue-layout">
          <div className="doc-card">
            <div className="doc-card-header">
              <div>
                <h3>Active OPD Visits</h3>
                <p>{isLoading ? 'Loading queue...' : `${sortedVisits.length} visits found`}</p>
              </div>
            </div>

            <div className="doc-table-wrap appointment-queue-table-wrap">
              <table className="doc-table">
                <colgroup>
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '25%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Patient &amp; Visit</th>
                    <th>Doctor</th>
                    <th>Wait</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td className="um-state-cell" colSpan={6}>
                        Loading OPD queue...
                      </td>
                    </tr>
                  ) : sortedVisits.length === 0 ? (
                    <tr>
                      <td className="um-state-cell" colSpan={6}>
                        No OPD visits found. Check in an appointment or register a walk-in to start the queue.
                      </td>
                    </tr>
                  ) : (
                    sortedVisits.map((visit, index) => (
                      <tr className={visit.id === currentVisit?.id ? 'queue-current-row' : ''} key={visit.id}>
                        <td>
                          <span className="queue-token-chip">{tokenFor(visit, index)}</span>
                        </td>
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
                                disabled={isUpdating || !canCreateVitals || !canEditVisit}
                                onClick={() => {
                                  setVitalsVisit(visit);
                                  resetVitals();
                                  setVitalsModalOpen(true);
                                }}
                                title="Step 1: Take Vitals"
                                type="button"
                              >
                                <i className="ph ph-heartbeat" aria-hidden="true" />
                                Take Vitals
                              </button>
                            ) : visit.status === 'READY_FOR_CONSULTATION' || visit.status === 'SKIPPED' ? (
                              <>
                                <button
                                  className="doc-btn success compact"
                                  disabled={isUpdating || !canEditVisit}
                                  onClick={async () => {
                                    await handleStatusChange(visit, 'IN_CONSULTATION');
                                    navigate(`/opd/consultation?id=${encodeURIComponent(visit.id)}`);
                                  }}
                                  title="Step 2: Start Consultation"
                                  type="button"
                                >
                                  <i className="ph ph-stethoscope" aria-hidden="true" />
                                  Start Consultation
                                </button>
                                <button
                                  className="doc-action"
                                  disabled={isUpdating || !canEditVisit}
                                  onClick={() => handleStatusChange(visit, 'SKIPPED', 'Patient skipped and moved behind waiting tokens.')}
                                  title="Skip Patient"
                                  type="button"
                                >
                                  <i className="ph ph-skip-forward" aria-hidden="true" />
                                </button>
                                <button
                                  className="doc-action error"
                                  disabled={isUpdating || !canEditVisit}
                                  onClick={() => {
                                    if (window.confirm('Mark this patient as No Show? They will be removed from the active queue.')) {
                                      void handleStatusChange(visit, 'NO_SHOW', 'Patient did not appear after queue call.');
                                    }
                                  }}
                                  title="Mark No Show"
                                  type="button"
                                >
                                  <i className="ph ph-user-minus" aria-hidden="true" />
                                </button>
                              </>
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
              <span>Current Token</span>
              <strong>{currentVisit ? tokenFor(currentVisit, currentIndex) : '-'}</strong>
              <p>{currentVisit?.patient_name ?? 'No patient in consultation'}</p>
            </div>
            <div className="opd-queue-stats">
              <div className="opd-queue-stat">
                <span>Next Token</span>
                <strong>{nextVisit ? tokenFor(nextVisit, nextIndex) : '-'}</strong>
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

            <div className="doc-action-group" style={{ margin: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                className="doc-btn primary full-width"
                disabled={isUpdating || !nextVisit || Boolean(currentVisit) || !canEditVisit}
                onClick={handleCallNext}
                type="button"
              >
                <i className="ph ph-megaphone" aria-hidden="true" />
                Call Next Patient
              </button>
            </div>

            <div className="opd-pending-list">
              <h4>Pending Appointment Check-ins</h4>
              {pendingAppointments.length === 0 ? (
                <p>No eligible appointments are waiting for OPD check-in.</p>
              ) : (
                pendingAppointments.slice(0, 5).map((appointment: AppointmentResponse) => (
                  <div className="opd-pending-item" key={appointment.id}>
                    <div>
                      <strong>{appointment.patient_name}</strong>
                      <span>
                        {appointment.start_time} - {appointment.doctor_name}
                      </span>
                    </div>
                    <button
                      className="doc-btn"
                      disabled={isUpdating || !canCreateVisit}
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
        <form className="modal-form doctor-onboarding-form" onSubmit={handleWalkInSubmit(onWalkInSubmit)}>
          {actionError ? <div className="form-error-banner" role="alert">{actionError}</div> : null}

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
                <select id="walk-in-patient" {...registerWalkIn('patient_id')}>
                  <option value="">Select patient</option>
                  {patients.map((patient: import('../api/patients').PatientResponse) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.patient_number} - {patient.first_name} {patient.last_name}
                    </option>
                  ))}
                </select>
                {walkInErrors.patient_id && <span className="form-error">{walkInErrors.patient_id.message}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="walk-in-doctor">
                  Doctor <span className="required-asterisk">*</span>
                </label>
                <select id="walk-in-doctor" {...registerWalkIn('doctor_id')}>
                  <option value="">Select doctor</option>
                  {doctors.map((doctor: import('../api/doctors').DoctorResponse) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.display_name} - {doctor.specialization}
                    </option>
                  ))}
                </select>
                {walkInErrors.doctor_id && <span className="form-error">{walkInErrors.doctor_id.message}</span>}
              </div>
              <div className="form-group full-width">
                <label htmlFor="walk-in-reason">Reason for Visit</label>
                <textarea
                  id="walk-in-reason"
                  placeholder="Presenting reason for walk-in visit"
                  rows={3}
                  {...registerWalkIn('reason')}
                />
                {walkInErrors.reason && <span className="form-error">{walkInErrors.reason.message}</span>}
              </div>
            </div>
          </section>

          <div className="modal-actions">
            <button className="secondary-action" onClick={() => setWalkInOpen(false)} type="button">
              Cancel
            </button>
            <button className="primary-action" disabled={isUpdating} type="submit">
              {isUpdating ? 'Checking in...' : 'Check in'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Vitals Modal */}
      <Modal
        footer={
          <>
            <button className="secondary-action" onClick={() => setVitalsModalOpen(false)} type="button">
              Cancel
            </button>
            <button className="primary-action" disabled={vitalsSubmitting} onClick={handleVitalsSubmit(onVitalsSubmit)} type="button">
              {vitalsSubmitting ? 'Saving Vitals...' : 'Save Vitals Record'}
            </button>
          </>
        }
        icon="ph-heartbeat"
        onClose={() => setVitalsModalOpen(false)}
        open={vitalsModalOpen}
        size="large"
        title="Record Clinical Vitals"
      >
        <form className="clinical-vitals-modal-body" onSubmit={handleVitalsSubmit(onVitalsSubmit)}>
          {actionError ? <div className="form-error-banner" role="alert">{actionError}</div> : null}

          {/* Clinical Patient Header Strip */}
          {vitalsVisit ? (
            <div className="clinical-vitals-patient-strip">
              <div className="clinical-vitals-patient-info">
                <div className="clinical-vitals-avatar">
                  {patientInitials(vitalsVisit.patient_name || 'Patient')}
                </div>
                <div className="clinical-vitals-patient-meta">
                  <h4>{vitalsVisit.patient_name}</h4>
                  <span>Visit No: <strong>{vitalsVisit.visit_number || 'OPD'}</strong> • Priority: {vitalsVisit.priority}</span>
                </div>
              </div>
              <div className="clinical-vitals-summary-chips">
                <span className="clinical-vital-summary-pill">
                  <i className="ph ph-stethoscope" /> OPD Triage
                </span>
                {mapVal !== null ? (
                  <span className="clinical-vital-summary-pill success">
                    <i className="ph ph-heartbeat" /> MAP: {mapVal} mmHg
                  </span>
                ) : null}
                {bmiObj ? (
                  <span className={`clinical-vital-summary-pill ${bmiObj.tone}`}>
                    <i className="ph ph-scales" /> BMI: {bmiObj.bmi} ({bmiObj.category})
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Clinical Vital Cards Grid */}
          <div className="clinical-vitals-grid">
            <ClinicalVitalCard
              disabled={vitalsSubmitting}
              icon="ph-heartbeat"
              id="sys-bp"
              label="Systolic Blood Pressure"
              max={300}
              min={40}
              normalRange="90 – 120 mmHg"
              onChange={(val) => setValueVitals('blood_pressure_systolic', val)}
              placeholder="120"
              statusLabel={evaluateSystolicBp((watchVitals('blood_pressure_systolic') || ''))?.label}
              statusTone={evaluateSystolicBp((watchVitals('blood_pressure_systolic') || ''))?.tone}
              step={1}
              themeColor="red"
              unit="mmHg"
              value={(watchVitals('blood_pressure_systolic') || '')}
            />

            <ClinicalVitalCard
              disabled={vitalsSubmitting}
              icon="ph-heart-straight"
              id="dia-bp"
              label="Diastolic Blood Pressure"
              max={200}
              min={30}
              normalRange="60 – 80 mmHg"
              onChange={(val) => setValueVitals('blood_pressure_diastolic', val)}
              placeholder="80"
              statusLabel={evaluateDiastolicBp((watchVitals('blood_pressure_diastolic') || ''))?.label}
              statusTone={evaluateDiastolicBp((watchVitals('blood_pressure_diastolic') || ''))?.tone}
              step={1}
              themeColor="rose"
              unit="mmHg"
              value={(watchVitals('blood_pressure_diastolic') || '')}
            />

            <ClinicalVitalCard
              disabled={vitalsSubmitting}
              icon="ph-heart"
              id="pulse"
              label="Heart / Pulse Rate"
              max={250}
              min={30}
              normalRange="60 – 100 bpm"
              onChange={(val) => setValueVitals('pulse_bpm', val)}
              placeholder="72"
              statusLabel={evaluatePulse((watchVitals('pulse_bpm') || ''))?.label}
              statusTone={evaluatePulse((watchVitals('pulse_bpm') || ''))?.tone}
              step={1}
              themeColor="rose"
              unit="bpm"
              value={(watchVitals('pulse_bpm') || '')}
            />

            <ClinicalVitalCard
              disabled={vitalsSubmitting}
              icon="ph-thermometer-simple"
              id="temp"
              label="Body Temperature"
              max={45}
              min={30}
              normalRange="36.5 – 37.5 °C"
              onChange={(val) => setValueVitals('temperature_c', val)}
              placeholder="36.8"
              statusLabel={evaluateTemperature((watchVitals('temperature_c') || ''))?.label}
              statusTone={evaluateTemperature((watchVitals('temperature_c') || ''))?.tone}
              step={0.1}
              themeColor="amber"
              unit="°C"
              value={(watchVitals('temperature_c') || '')}
            />

            <ClinicalVitalCard
              disabled={vitalsSubmitting}
              icon="ph-drop"
              id="spo2"
              label="Oxygen Saturation (SpO₂)"
              max={100}
              min={50}
              normalRange="95 – 100 %"
              onChange={(val) => setValueVitals('oxygen_saturation_percent', val)}
              placeholder="98"
              statusLabel={evaluateSpo2((watchVitals('oxygen_saturation_percent') || ''))?.label}
              statusTone={evaluateSpo2((watchVitals('oxygen_saturation_percent') || ''))?.tone}
              step={1}
              themeColor="sky"
              unit="%"
              value={(watchVitals('oxygen_saturation_percent') || '')}
            />

            <ClinicalVitalCard
              disabled={vitalsSubmitting}
              icon="ph-wind"
              id="resp"
              label="Respiratory Rate"
              max={60}
              min={6}
              normalRange="12 – 20 breaths/min"
              onChange={(val) => setValueVitals('respiratory_rate_per_min', val)}
              placeholder="16"
              statusLabel={evaluateRespiratoryRate((watchVitals('respiratory_rate_per_min') || ''))?.label}
              statusTone={evaluateRespiratoryRate((watchVitals('respiratory_rate_per_min') || ''))?.tone}
              step={1}
              themeColor="teal"
              unit="/min"
              value={(watchVitals('respiratory_rate_per_min') || '')}
            />

            <ClinicalVitalCard
              disabled={vitalsSubmitting}
              icon="ph-scales"
              id="weight"
              label="Body Weight"
              max={400}
              min={1}
              normalRange="Adult kg"
              onChange={(val) => setValueVitals('weight_kg', val)}
              placeholder="70"
              step={0.5}
              themeColor="violet"
              unit="kg"
              value={(watchVitals('weight_kg') || '')}
            />

            <ClinicalVitalCard
              disabled={vitalsSubmitting}
              icon="ph-arrows-out-line-vertical"
              id="height"
              label="Body Height"
              max={260}
              min={30}
              normalRange="Adult cm"
              onChange={(val) => setValueVitals('height_cm', val)}
              placeholder="170"
              step={1}
              themeColor="indigo"
              unit="cm"
              value={(watchVitals('height_cm') || '')}
            />
          </div>

          {/* Derived Clinical Health Summary (BMI & MAP) */}
          {(bmiObj || mapVal !== null) ? (
            <div className="clinical-derived-metrics-card">
              {bmiObj ? (
                <div className="clinical-derived-metric-item">
                  <i className="ph ph-scales" />
                  <div className="clinical-derived-metric-text">
                    <span className="clinical-derived-metric-label">Body Mass Index (BMI)</span>
                    <span className="clinical-derived-metric-value">{bmiObj.bmi} kg/m² • {bmiObj.category}</span>
                  </div>
                </div>
              ) : null}
              {mapVal !== null ? (
                <div className="clinical-derived-metric-item">
                  <i className="ph ph-heartbeat" />
                  <div className="clinical-derived-metric-text">
                    <span className="clinical-derived-metric-label">Mean Arterial Pressure (MAP)</span>
                    <span className="clinical-derived-metric-value">{mapVal} mmHg (Normal: 70–105 mmHg)</span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </form>
      </Modal>

      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />
    </>
  );
}