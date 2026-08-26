import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { ApiOpdVisitPriority, ApiOpdVisitStatus, OpdVisitResponse } from '../api/opd';
import { useOpdQueue, type OpdQueueFilters } from '../hooks/opd/useOpdQueue';
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

type StatusFilter = Extract<ApiOpdVisitStatus, 'READY_FOR_CONSULTATION' | 'IN_CONSULTATION' | 'SKIPPED' | 'COMPLETED'> | '';
type PriorityFilter = ApiOpdVisitPriority | '';

const clinicianStatuses = new Set<ApiOpdVisitStatus>(['READY_FOR_CONSULTATION', 'IN_CONSULTATION', 'SKIPPED', 'COMPLETED']);

const tokenFor = (visit: OpdVisitResponse, index: number) =>
  `O${String(visit.queue_token_number ?? index + 1).padStart(3, '0')}`;

const waitMinutes = (visit: OpdVisitResponse) => {
  if (!isActiveVisit(visit)) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(visit.check_in_time).getTime()) / 60000));
};

const visitSort = (left: OpdVisitResponse, right: OpdVisitResponse) => {
  if (left.status === 'SKIPPED' && right.status !== 'SKIPPED') return 1;
  if (left.status !== 'SKIPPED' && right.status === 'SKIPPED') return -1;
  if (left.queue_token_number !== null && right.queue_token_number !== null) return left.queue_token_number - right.queue_token_number;
  return new Date(left.check_in_time).getTime() - new Date(right.check_in_time).getTime();
};

const isStatusFilter = (value: string | null): value is Exclude<StatusFilter, ''> =>
  value !== null && ['READY_FOR_CONSULTATION', 'IN_CONSULTATION', 'SKIPPED', 'COMPLETED'].includes(value);

const isPriorityFilter = (value: string | null): value is ApiOpdVisitPriority =>
  value !== null && ['ROUTINE', 'URGENT', 'EMERGENCY'].includes(value);

export function OpdQueuePage() {
  const { search } = useAppLocation();
  const initialParams = new URLSearchParams(search);
  const [filters, setFilters] = useState<OpdQueueFilters>({
    search: initialParams.get('search') ?? '',
    department_id: initialParams.get('department_id') ?? '',
    doctor_id: initialParams.get('doctor_id') ?? '',
    status: isStatusFilter(initialParams.get('status')) ? initialParams.get('status') as Exclude<StatusFilter, ''> : '',
    priority: isPriorityFilter(initialParams.get('priority')) ? initialParams.get('priority') as ApiOpdVisitPriority : '',
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
      blood_pressure_systolic: '',
      blood_pressure_diastolic: '',
      weight_kg: '',
      height_cm: '',
      temperature_c: '',
      pulse_bpm: '',
      respiratory_rate_per_min: '',
      oxygen_saturation_percent: '',
      notes: '',
    },
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
  const { visits, doctors, departments, isLoading, error, isUpdating, updateVisitStatus, canEditVisit } = useOpdQueue(filters);

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
    if (window.location.pathname + window.location.search !== nextUrl) navigate(nextUrl, { replace: true });
  }, [filters]);

  const clinicianVisits = useMemo(() => visits.filter((visit) => clinicianStatuses.has(visit.status)).sort(visitSort), [visits]);
  const readyVisits = clinicianVisits.filter((visit) => visit.status === 'READY_FOR_CONSULTATION' || visit.status === 'SKIPPED');
  const inConsultation = clinicianVisits.filter((visit) => visit.status === 'IN_CONSULTATION');
  const completed = clinicianVisits.filter((visit) => visit.status === 'COMPLETED');
  const averageWait = readyVisits.length ? Math.round(readyVisits.reduce((total, visit) => total + waitMinutes(visit), 0) / readyVisits.length) : 0;
  const isPastDate = Boolean(filters.date && filters.date < todayInputValue());

  const startConsultation = async (visit: OpdVisitResponse) => {
    if (!canEditVisit) return;
    try {
      await updateVisitStatus({ id: visit.id, payload: { status: 'IN_CONSULTATION' } });
      navigate(`/opd/consultation?id=${encodeURIComponent(visit.id)}`);
    } catch (updateError) {
      toast.error(getOpdErrorMessage(updateError));
    }
  };

  return (
    <div className="opd-page">
      <section className="opd-page-header">
        <div className="opd-page-title"><h2>Doctor Waiting Queue</h2><p>Review consultation-ready patients in persisted token order</p></div>
        <button className="doc-btn" onClick={() => window.location.reload()} type="button"><i className="ph ph-arrow-clockwise" aria-hidden="true" /> Refresh Queue</button>
      </section>

      <section className="doc-kpi-grid opd-kpi-grid">
        {([
          ['ph-users-three', 'orange', 'Ready for Consultation', readyVisits.length, 'Clinical queue'],
          ['ph-stethoscope', 'cyan', 'In Consultation', inConsultation.length, 'Doctor active'],
          ['ph-check-circle', 'green', 'Completed', completed.length, 'Selected date'],
          ['ph-timer', 'purple', 'Average Wait', `${averageWait} min`, 'Live estimate'],
        ] as const).map(([icon, tone, label, value, copy]) => (
          <article className="doc-kpi" key={label}><span className={`doc-kpi-icon ${tone}`}><i className={`ph ${icon}`} aria-hidden="true" /></span><div className="doc-kpi-copy"><span>{label}</span><strong>{isLoading ? '-' : value}</strong><small>{copy}</small></div></article>
        ))}
      </section>

      <section className="doc-toolbar">
        <div className="doc-field grow doc-search"><label htmlFor="opd-search">Search Doctor Queue</label><i className="ph ph-magnifying-glass" aria-hidden="true" /><input id="opd-search" onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search visit, MRN, patient, or doctor" type="search" value={filters.search} /></div>
        <div className="doc-field"><label htmlFor="opd-department">Department</label><select id="opd-department" onChange={(event) => setFilters((current) => ({ ...current, department_id: event.target.value }))} value={filters.department_id}><option value="">All Departments</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>
        <div className="doc-field"><label htmlFor="opd-doctor">Doctor</label><select id="opd-doctor" onChange={(event) => setFilters((current) => ({ ...current, doctor_id: event.target.value }))} value={filters.doctor_id}><option value="">All Doctors</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.display_name}</option>)}</select></div>
        <div className="doc-field"><label htmlFor="opd-status">Status</label><select id="opd-status" onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as StatusFilter }))} value={filters.status}><option value="">All Clinical Statuses</option><option value="READY_FOR_CONSULTATION">Ready for Consultation</option><option value="IN_CONSULTATION">In Consultation</option><option value="SKIPPED">Skipped</option><option value="COMPLETED">Completed</option></select></div>
        <div className="doc-field"><label htmlFor="opd-priority">Priority</label><select id="opd-priority" onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value as PriorityFilter }))} value={filters.priority}><option value="">All Priorities</option>{Object.entries(opdVisitPriorityLabels).map(([priority, label]) => <option key={priority} value={priority}>{label}</option>)}</select></div>
        <div className="doc-field"><label htmlFor="opd-date">Date</label><input id="opd-date" onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))} type="date" value={filters.date} /></div>
      </section>

      {error ? <div className="form-error-banner">{getOpdErrorMessage(error)}</div> : null}
      <section className="doc-card">
        <div className="doc-card-header"><div><h3>Consultation Queue</h3><p>{isLoading ? 'Loading queue...' : `${clinicianVisits.length} clinical visits`}</p></div></div>
        <div className="doc-table-wrap appointment-queue-table-wrap">
          <table className="doc-table">
            <thead><tr><th>Token</th><th>Patient &amp; Visit</th><th>Doctor</th><th>Wait</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {isLoading ? <tr><td className="um-state-cell" colSpan={7}>Loading doctor queue...</td></tr> : clinicianVisits.length === 0 ? <tr><td className="um-state-cell" colSpan={7}>No patients are ready for consultation for the selected filters.</td></tr> : clinicianVisits.map((visit, index) => (
                <tr key={visit.id}>
                  <td><span className="queue-token-chip">{tokenFor(visit, index)}</span></td>
                  <td><div className="doc-person"><span className="doc-avatar">{patientInitials(visit.patient_name)}</span><div><strong>{visit.patient_name}</strong><span>{visit.visit_number}</span></div></div></td>
                  <td><strong>{visit.doctor_name}</strong><br /><small>{visit.doctor_specialization}</small></td>
                  <td>{waitMinutes(visit)} min</td>
                  <td><span className={`doc-status ${visitPriorityClass(visit.priority)}`}>{opdVisitPriorityLabels[visit.priority]}</span></td>
                  <td><span className={`doc-status ${visitStatusClass(visit.status)}`}>{opdVisitStatusLabels[visit.status]}</span></td>
                  <td><div style={{ alignItems: 'center', display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', minWidth: 'max-content' }}>
                    {visit.status === 'READY_FOR_CONSULTATION' || visit.status === 'SKIPPED' ? <button className="doc-btn primary compact" disabled={isUpdating || !canEditVisit || isPastDate} onClick={() => void startConsultation(visit)} type="button"><i className="ph ph-stethoscope" aria-hidden="true" /> Start Consultation</button> : null}
                    {visit.status === 'IN_CONSULTATION' ? <button className="doc-btn primary compact" onClick={() => navigate(`/opd/consultation?id=${encodeURIComponent(visit.id)}`)} type="button">Consultation</button> : null}
                    <button className="doc-action" onClick={() => navigate(`/opd/visit?id=${encodeURIComponent(visit.id)}`)} title="View visit" type="button"><i className="ph ph-arrow-square-out" aria-hidden="true" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
