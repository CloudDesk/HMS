import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { ApiOpdVisitPriority, ApiOpdVisitStatus, OpdVisitResponse } from '../api/opd';
import { useOpdQueue, type OpdQueueFilters } from '../hooks/opd/useOpdQueue';
import { navigate, useAppLocation } from '../routing/navigation';
import { MedicalLoader } from '../components/ui/MedicalLoader';
import { isDentalVisit } from './dental-utils';
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
const dentalCheckInStatuses = new Set<ApiOpdVisitStatus>(['CHECKED_IN', 'WAITING_FOR_VITALS']);

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


  const { visits, doctors, departments, isLoading, error, isUpdating, updateVisitStatus, canEditVisit, canViewConsultation, canEditConsultation, isDoctorUser } = useOpdQueue(filters);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.search?.trim()) params.set('search', filters.search.trim());
    if (!isDoctorUser && filters.department_id) params.set('department_id', filters.department_id);
    if (!isDoctorUser && filters.doctor_id) params.set('doctor_id', filters.doctor_id);
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.date !== todayInputValue()) params.set('date', filters.date);
    const query = params.toString();
    const nextUrl = `/opd/queue${query ? `?${query}` : ''}`;
    if (window.location.pathname + window.location.search !== nextUrl) navigate(nextUrl, { replace: true });
  }, [filters, isDoctorUser]);

  const clinicianVisits = useMemo(() => visits.filter((visit) =>
    clinicianStatuses.has(visit.status)
    || (dentalCheckInStatuses.has(visit.status) && isDentalVisit(visit, departments)),
  ).sort(visitSort), [departments, visits]);
  const readyVisits = clinicianVisits.filter((visit) =>
    visit.status === 'READY_FOR_CONSULTATION'
    || visit.status === 'SKIPPED'
    || (dentalCheckInStatuses.has(visit.status) && isDentalVisit(visit, departments)),
  );
  const inConsultation = clinicianVisits.filter((visit) => visit.status === 'IN_CONSULTATION');
  const completed = clinicianVisits.filter((visit) => visit.status === 'COMPLETED');
  const averageWait = readyVisits.length ? Math.round(readyVisits.reduce((total, visit) => total + waitMinutes(visit), 0) / readyVisits.length) : 0;
  const isPastDate = Boolean(filters.date && filters.date < todayInputValue());

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(clinicianVisits.length / pageSize));
  const paginatedVisits = useMemo(() => {
    const start = (page - 1) * pageSize;
    return clinicianVisits.slice(start, start + pageSize);
  }, [clinicianVisits, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

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
        <div className="opd-page-title"><h2>Patients Queue</h2><p>Review consultation-ready patients in token order</p></div>
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
        <div className="doc-field grow doc-search"><label htmlFor="opd-search">Search Patients Queue</label><i className="ph ph-magnifying-glass" aria-hidden="true" /><input id="opd-search" onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder={isDoctorUser ? 'Search visit, MRN, or patient' : 'Search visit, MRN, patient, or doctor'} type="search" value={filters.search} /></div>
        {!isDoctorUser ? <div className="doc-field"><label htmlFor="opd-department">Department</label><select id="opd-department" onChange={(event) => setFilters((current) => ({ ...current, department_id: event.target.value }))} value={filters.department_id}><option value="">All Departments</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div> : null}
        {!isDoctorUser ? <div className="doc-field"><label htmlFor="opd-doctor">Doctor</label><select id="opd-doctor" onChange={(event) => setFilters((current) => ({ ...current, doctor_id: event.target.value }))} value={filters.doctor_id}><option value="">All Doctors</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.display_name}</option>)}</select></div> : null}
        <div className="doc-field"><label htmlFor="opd-status">Status</label><select id="opd-status" onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as StatusFilter }))} value={filters.status}><option value="">All Clinical Statuses</option><option value="READY_FOR_CONSULTATION">Ready for Consultation</option><option value="IN_CONSULTATION">In Consultation</option><option value="SKIPPED">Skipped</option><option value="COMPLETED">Completed</option></select></div>
        <div className="doc-field"><label htmlFor="opd-priority">Priority</label><select id="opd-priority" onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value as PriorityFilter }))} value={filters.priority}><option value="">All Priorities</option>{Object.entries(opdVisitPriorityLabels).map(([priority, label]) => <option key={priority} value={priority}>{label}</option>)}</select></div>
        <div className="doc-field"><label htmlFor="opd-date">Date</label><input id="opd-date" onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))} type="date" value={filters.date} /></div>
      </section>

      {error ? <div className="form-error-banner">{getOpdErrorMessage(error)}</div> : null}
      <section className="doc-card opd-queue-card consultation-queue-card">
        <div className="doc-card-header"><div><h3>Consultation Queue</h3><p>{isLoading ? 'Loading queue...' : `${clinicianVisits.length} clinical visits`}</p></div></div>
        <div className="doc-table-wrap opd-queue-table-wrap table-responsive" tabIndex={0} role="region" aria-label="Consultation queue" aria-busy={isLoading}>
          <table className="data-table opd-queue-table">
            <colgroup>
              <col className="col-token" style={{ width: isDoctorUser ? '9%' : '7%' }} />
              <col className="col-patient" style={{ width: isDoctorUser ? '32%' : '23%' }} />
              {!isDoctorUser ? <col className="col-doctor" style={{ width: '17%' }} /> : null}
              <col className="col-wait" style={{ width: isDoctorUser ? '10%' : '8%' }} />
              <col className="col-priority" style={{ width: isDoctorUser ? '12%' : '11%' }} />
              <col className="col-status" style={{ width: isDoctorUser ? '15%' : '14%' }} />
              <col className="col-actions" style={{ width: isDoctorUser ? '22%' : '20%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="col-token-th">Token</th>
                <th className="col-patient-th">Patient</th>
                {!isDoctorUser ? <th className="col-doctor-th">Doctor</th> : null}
                <th className="col-wait-th">Wait</th>
                <th className="col-priority-th">Priority</th>
                <th className="col-status-th">Status</th>
                <th className="col-actions-th align-right" style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={isDoctorUser ? 6 : 7} style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
                    <MedicalLoader
                      text="Loading doctor queue..."
                      subtext="Retrieving consultation waiting queue"
                    />
                  </td>
                </tr>
              ) : clinicianVisits.length === 0 ? (
                <tr>
                  <td className="um-state-cell opd-empty-state-cell" colSpan={isDoctorUser ? 6 : 7}>
                    <div className="opd-empty-state-wrapper">
                      <div className="opd-empty-state-icon">
                        <i className="ph ph-users-three" aria-hidden="true" />
                      </div>
                      <strong className="opd-empty-state-title">No Patients Ready for Consultation</strong>
                      <p className="opd-empty-state-text">
                        No patients waiting in consultation queue.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : paginatedVisits.map((visit, index) => {
                const globalIndex = (page - 1) * pageSize + index;
                const isDentalCheckIn = dentalCheckInStatuses.has(visit.status) && isDentalVisit(visit, departments);
                return (
                <tr key={visit.id}>
                  <td className="col-token-cell">
                    <span className="queue-token-chip">{tokenFor(visit, globalIndex)}</span>
                  </td>
                  <td className="col-patient-cell">
                    <div className="doc-person">
                      <span className="doc-avatar">{patientInitials(visit.patient_name)}</span>
                      <div className="doc-person-info">
                        <strong className="doc-person-name" title={visit.patient_name}>{visit.patient_name}</strong>
                      </div>
                    </div>
                  </td>
                  {!isDoctorUser ? (
                    <td className="col-doctor-cell">
                      <div className="opd-doctor-info">
                        <strong className="opd-doctor-name" title={visit.doctor_name}>{visit.doctor_name}</strong>
                        <span className="opd-doctor-dept" title={visit.doctor_specialization}>{visit.doctor_specialization}</span>
                      </div>
                    </td>
                  ) : null}
                  <td className="col-wait-cell">
                    <span className="opd-wait-text">{waitMinutes(visit)} min</span>
                  </td>
                  <td className="col-priority-cell">
                    <span className={`doc-status ${visitPriorityClass(visit.priority)}`}>{opdVisitPriorityLabels[visit.priority]}</span>
                  </td>
                  <td className="col-status-cell">
                    <span className={`doc-status ${visitStatusClass(visit.status)}`}>{opdVisitStatusLabels[visit.status]}</span>
                  </td>
                  <td className="col-actions-cell align-right">
                    <div className="opd-queue-actions">
                      {(visit.status === 'READY_FOR_CONSULTATION' || visit.status === 'SKIPPED' || isDentalCheckIn) && canEditConsultation && canEditVisit ? (
                        <button className="doc-btn primary compact" disabled={isUpdating || isPastDate} onClick={() => void startConsultation(visit)} type="button">
                          <i className="ph ph-stethoscope" aria-hidden="true" /> {isDentalCheckIn ? 'Start Dental Consultation' : 'Start Consultation'}
                        </button>
                      ) : null}
                      {visit.status === 'IN_CONSULTATION' && canViewConsultation ? (
                        <button className="doc-btn primary compact" onClick={() => navigate(`/opd/consultation?id=${encodeURIComponent(visit.id)}`)} type="button">
                          Consultation
                        </button>
                      ) : null}
                      <button className="doc-action" onClick={() => navigate(`/opd/visit?id=${encodeURIComponent(visit.id)}`)} title="View visit" type="button">
                        <i className="ph ph-arrow-square-out" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {clinicianVisits.length > 0 && (
          <div className="um-pagination" style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid #e2e8f0', margin: 0 }}>
            <div>
              Showing <strong>{Math.min((page - 1) * pageSize + 1, clinicianVisits.length)}</strong> to{' '}
              <strong>{Math.min(page * pageSize, clinicianVisits.length)}</strong> of{' '}
              <strong>{clinicianVisits.length}</strong> clinical visits
            </div>
            <div className="um-page-controls">
              <button
                type="button"
                className="pg-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
              >
                <i className="ph ph-caret-left" />
              </button>
              <span className="pg-btn active" aria-current="page">
                {page}
              </span>
              <button
                type="button"
                className="pg-btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Next page"
              >
                <i className="ph ph-caret-right" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
