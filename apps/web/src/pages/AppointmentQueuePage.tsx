import { useCallback, useEffect, useMemo, useState } from 'react';
import { appointmentsApi, type ApiAppointmentPriority, type ApiAppointmentStatus, type AppointmentResponse } from '../api/appointments';
import { branchesApi, type BranchResponse } from '../api/branches';
import { departmentsApi, type DepartmentResponse } from '../api/departments';
import { doctorsApi, type DoctorResponse } from '../api/doctors';
import { opdApi, type OpdVisitResponse } from '../api/opd';
import { Toast } from '../components/ui/Toast';
import { navigate, useAppLocation } from '../routing/navigation';
import {
  appointmentPriorityClass,
  appointmentPriorityLabels,
  appointmentStatusClass,
  appointmentStatusLabels,
  getAppointmentErrorMessage,
  todayInputValue,
} from './appointment-utils';

type QueueStatusFilter = ApiAppointmentStatus | '';
type QueuePriorityFilter = ApiAppointmentPriority | '';

const waitingStatuses = new Set<ApiAppointmentStatus>(['SCHEDULED', 'CONFIRMED', 'SKIPPED']);

const toMinutes = (value: string) => {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const tokenFor = (appointment: AppointmentResponse, index: number) =>
  `${appointment.priority === 'EMERGENCY' ? 'E' : 'A'}${String(index + 1).padStart(3, '0')}`;

const queueSort = (left: AppointmentResponse, right: AppointmentResponse) => {
  if (left.status === 'SKIPPED' && right.status !== 'SKIPPED') return 1;
  if (left.status !== 'SKIPPED' && right.status === 'SKIPPED') return -1;
  if (left.priority === 'EMERGENCY' && right.priority !== 'EMERGENCY') return -1;
  if (left.priority !== 'EMERGENCY' && right.priority === 'EMERGENCY') return 1;
  return toMinutes(left.start_time) - toMinutes(right.start_time);
};

const waitMinutes = (appointment: AppointmentResponse, index: number) => {
  if (appointment.status === 'CHECKED_IN') return Math.max(0, index * 8);
  if (appointment.status === 'COMPLETED' || appointment.status === 'NO_SHOW' || appointment.status === 'CANCELLED') return 0;
  return Math.max(8, index * 8 + 8);
};

const downloadQueue = (appointments: AppointmentResponse[]) => {
  const rows = [
    ['Token', 'Patient', 'MRN', 'Department', 'Doctor', 'Check-in', 'Priority', 'Status'],
    ...appointments.map((appointment, index) => [
      tokenFor(appointment, index),
      appointment.patient_name,
      appointment.patient_number,
      appointment.doctor_specialization,
      appointment.doctor_name,
      appointment.start_time,
      appointmentPriorityLabels[appointment.priority],
      appointmentStatusLabels[appointment.status],
    ]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `appointment-queue-${todayInputValue()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

export function AppointmentQueuePage() {
  const { search } = useAppLocation();
  const initialParams = new URLSearchParams(search);
  const [appointments, setAppointments] = useState<AppointmentResponse[]>([]);
  const [opdVisits, setOpdVisits] = useState<OpdVisitResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState(initialParams.get('department_id') ?? '');
  const [doctorFilter, setDoctorFilter] = useState(initialParams.get('doctor_id') ?? '');
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>((initialParams.get('status') as ApiAppointmentStatus | null) ?? '');
  const [priorityFilter, setPriorityFilter] = useState<QueuePriorityFilter>(
    (initialParams.get('priority') as ApiAppointmentPriority | null) ?? '',
  );
  const [branchFilter, setBranchFilter] = useState(initialParams.get('branch_id') ?? '');
  const [queueDate, setQueueDate] = useState(initialParams.get('date') ?? todayInputValue());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [opdLoadError, setOpdLoadError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
  const [completionError, setCompletionError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');

  const sortedAppointments = useMemo(() => [...appointments].sort(queueSort), [appointments]);
  const currentAppointment = sortedAppointments.find((appointment) => appointment.status === 'CHECKED_IN') ?? null;
  const nextAppointment = sortedAppointments.find((appointment) => waitingStatuses.has(appointment.status)) ?? null;
  const currentIndex = currentAppointment ? sortedAppointments.findIndex((appointment) => appointment.id === currentAppointment.id) : -1;
  const nextIndex = nextAppointment ? sortedAppointments.findIndex((appointment) => appointment.id === nextAppointment.id) : -1;
  const waitingCount = sortedAppointments.filter((appointment) => waitingStatuses.has(appointment.status)).length;
  const inConsultationCount = sortedAppointments.filter((appointment) => appointment.status === 'CHECKED_IN').length;
  const completedCount = sortedAppointments.filter((appointment) => appointment.status === 'COMPLETED').length;
  const noShowCount = sortedAppointments.filter((appointment) => appointment.status === 'NO_SHOW').length;
  const averageWait = waitingCount === 0
    ? 0
    : Math.round(
        sortedAppointments
          .filter((appointment) => waitingStatuses.has(appointment.status))
          .reduce((total, appointment, index) => total + waitMinutes(appointment, index), 0) / waitingCount,
      );
  const visitForAppointment = (appointmentId: string) =>
    opdVisits.find((visit) => visit.appointment_id === appointmentId) ?? null;

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastTone(tone);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 3000);
  };

  const loadLookups = useCallback(async () => {
    const [departmentResponse, doctorResponse, branchResponse] = await Promise.all([
      departmentsApi.list({ status: 'ACTIVE', limit: 100 }),
      doctorsApi.list({ status: 'ACTIVE', limit: 100, sortBy: 'display_name', sortOrder: 'asc' }),
      branchesApi.list({ status: 'ACTIVE', limit: 100, sortBy: 'name', sortOrder: 'asc' }),
    ]);
    setDepartments(departmentResponse.data);
    setDoctors(doctorResponse.data);
    setBranches(branchResponse.data);
  }, []);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setOpdLoadError('');

    try {
      const response = await appointmentsApi.list({
        date_from: queueDate,
        date_to: queueDate,
        department_id: departmentFilter || undefined,
        doctor_id: doctorFilter || undefined,
        branch_id: branchFilter || undefined,
        status: statusFilter || undefined,
        limit: 100,
        sortBy: 'start_time',
        sortOrder: 'asc',
      });
      setAppointments(response.data.filter((appointment) => !priorityFilter || appointment.priority === priorityFilter));

      try {
        const visitResponse = await opdApi.listVisits({
          date_from: queueDate,
          date_to: queueDate,
          department_id: departmentFilter || undefined,
          doctor_id: doctorFilter || undefined,
          branch_id: branchFilter || undefined,
          limit: 100,
        });
        setOpdVisits(visitResponse.data);
      } catch (error) {
        setOpdVisits([]);
        setOpdLoadError(getAppointmentErrorMessage(error));
      }
    } catch (error) {
      setAppointments([]);
      setOpdVisits([]);
      setLoadError(getAppointmentErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [branchFilter, departmentFilter, doctorFilter, priorityFilter, queueDate, statusFilter]);

  useEffect(() => {
    void loadLookups().catch((error) => setLoadError(getAppointmentErrorMessage(error)));
  }, [loadLookups]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (departmentFilter) params.set('department_id', departmentFilter);
    if (doctorFilter) params.set('doctor_id', doctorFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (priorityFilter) params.set('priority', priorityFilter);
    if (branchFilter) params.set('branch_id', branchFilter);
    if (queueDate !== todayInputValue()) params.set('date', queueDate);
    const query = params.toString();
    const nextUrl = `/appointments/queue${query ? `?${query}` : ''}`;
    if (window.location.pathname + window.location.search !== nextUrl) {
      navigate(nextUrl, { replace: true });
    }
  }, [branchFilter, departmentFilter, doctorFilter, priorityFilter, queueDate, statusFilter]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const updateStatus = async (appointment: AppointmentResponse, status: ApiAppointmentStatus, notes?: string) => {
    setUpdating(true);
    try {
      await appointmentsApi.updateStatus(appointment.id, { status, notes });
      await loadAppointments();
      showToast(`Queue token ${appointment.appointment_number} marked ${appointmentStatusLabels[status].toLowerCase()}.`);
    } catch (error) {
      showToast(getAppointmentErrorMessage(error), 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleCallNext = async () => {
    if (currentAppointment) {
      showToast('Complete or skip the current patient first.', 'error');
      return;
    }

    if (!nextAppointment) {
      showToast('No waiting patient is available in the queue.', 'error');
      return;
    }

    const linkedVisit = visitForAppointment(nextAppointment.id);
    if (linkedVisit) {
      await updateStatus(nextAppointment, 'CHECKED_IN', 'Patient called from appointment queue.');
      return;
    }

    setUpdating(true);
    try {
      await opdApi.createVisit({
        appointment_id: nextAppointment.id,
        notes: 'Patient checked in from appointment queue.',
      });
      await loadAppointments();
      showToast(`Queue token ${nextAppointment.appointment_number} checked in to OPD.`);
    } catch (error) {
      showToast(getAppointmentErrorMessage(error), 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleRecall = () => {
    if (!currentAppointment) {
      showToast('No active patient is currently called.', 'error');
      return;
    }

    showToast(`Recalled ${currentAppointment.patient_name} for token ${tokenFor(currentAppointment, currentIndex)}.`);
  };

  const handleSkip = async () => {
    if (!currentAppointment) {
      showToast('Call a patient before skipping the queue token.', 'error');
      return;
    }

    await updateStatus(currentAppointment, 'SKIPPED', 'Patient skipped and moved behind waiting tokens.');
  };

  const handleNoShow = async () => {
    if (!currentAppointment) {
      showToast('Call a patient before marking no show.', 'error');
      return;
    }

    const linkedVisit = visitForAppointment(currentAppointment.id);
    if (!linkedVisit) {
      await updateStatus(currentAppointment, 'NO_SHOW', 'Patient did not appear after queue call.');
      return;
    }

    setUpdating(true);
    try {
      await opdApi.updateVisitStatus(linkedVisit.id, {
        notes: 'Patient did not appear after queue call.',
        status: 'NO_SHOW',
      });
      await loadAppointments();
      showToast(`Queue token ${currentAppointment.appointment_number} marked no show.`);
    } catch (error) {
      showToast(getAppointmentErrorMessage(error), 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleComplete = async () => {
    if (!currentAppointment) {
      showToast('Call a patient before completing the visit.', 'error');
      return;
    }

    setCompletionNote('');
    setCompletionError('');
    setCompleteOpen(true);
  };

  const submitCompletion = async () => {
    if (!currentAppointment) return;
    if (!completionNote.trim()) {
      setCompletionError('Completion note is required before marking the visit completed.');
      return;
    }

    const linkedVisit = visitForAppointment(currentAppointment.id);
    if (!linkedVisit) {
      setCompletionError('This appointment must be checked in to OPD before it can be completed.');
      return;
    }

    setUpdating(true);
    try {
      await opdApi.updateVisitStatus(linkedVisit.id, {
        notes: completionNote.trim(),
        status: 'COMPLETED',
      });
      setCompleteOpen(false);
      await loadAppointments();
      showToast(`Queue token ${currentAppointment.appointment_number} completed.`);
    } catch (error) {
      setCompletionError(getAppointmentErrorMessage(error));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <div className="appointment-page">
        <section className="appointment-page-header">
          <div className="appointment-page-title">
            <h2>Queue Management</h2>
            <p>Coordinate patient flow and consultation status</p>
          </div>
          <div className="appointment-page-actions">
            <button className="doc-btn primary" onClick={() => navigate('/appointments/book?mode=walkin')} type="button">
              <i className="ph ph-person-simple-walk" aria-hidden="true" />
              Register Walk-in
            </button>
          </div>
        </section>

        <section className="doc-kpi-grid appointment-kpi-grid">
          {[
            ['ph-users-three', 'orange', 'Patients Waiting', waitingCount, 'Across departments'],
            ['ph-stethoscope', 'cyan', 'Currently In Consultation', inConsultationCount, 'Active consultations'],
            ['ph-check-circle', 'green', 'Completed', completedCount, 'Today'],
            ['ph-user-minus', 'red', 'No Show', noShowCount, 'Needs review'],
            ['ph-timer', 'purple', 'Average Waiting Time', `${averageWait} min`, 'Live estimate'],
          ].map(([icon, tone, label, value, copy]) => (
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

        <section className="doc-toolbar">
          <div className="doc-field">
            <label htmlFor="queue-department">Department</label>
            <select id="queue-department" onChange={(event) => setDepartmentFilter(event.target.value)} value={departmentFilter}>
              <option value="">All Departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
          <div className="doc-field">
            <label htmlFor="queue-doctor">Doctor</label>
            <select id="queue-doctor" onChange={(event) => setDoctorFilter(event.target.value)} value={doctorFilter}>
              <option value="">All Doctors</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.display_name}
                </option>
              ))}
            </select>
          </div>
          <div className="doc-field">
            <label htmlFor="queue-status">Queue Status</label>
            <select
              id="queue-status"
              onChange={(event) => setStatusFilter(event.target.value as QueueStatusFilter)}
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
            <label htmlFor="queue-priority">Priority</label>
            <select
              id="queue-priority"
              onChange={(event) => setPriorityFilter(event.target.value as QueuePriorityFilter)}
              value={priorityFilter}
            >
              <option value="">All Priorities</option>
              <option value="ROUTINE">Routine</option>
              <option value="EMERGENCY">Emergency</option>
            </select>
          </div>
          <div className="doc-field">
            <label htmlFor="queue-date">Date</label>
            <input id="queue-date" onChange={(event) => setQueueDate(event.target.value)} type="date" value={queueDate} />
          </div>
          <div className="doc-field">
            <label htmlFor="queue-branch">Branch</label>
            <select id="queue-branch" onChange={(event) => setBranchFilter(event.target.value)} value={branchFilter}>
              <option value="">All Branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {loadError ? <div className="form-error-banner">{loadError}</div> : null}
        {opdLoadError ? (
          <div className="form-error-banner">
            OPD visit linkage is unavailable. Clinical queue actions are restricted: {opdLoadError}
          </div>
        ) : null}

        <section className="appointment-queue-layout">
          <div className="doc-card">
            <div className="doc-card-header">
              <div>
                <h3>Patient Queue</h3>
                <p>{loading ? 'Loading queue...' : `${sortedAppointments.length} queue records`}</p>
              </div>
              <button className="doc-btn" onClick={() => downloadQueue(sortedAppointments)} type="button">
                <i className="ph ph-download-simple" aria-hidden="true" />
                Export
              </button>
            </div>

            <div className="doc-table-wrap appointment-queue-table-wrap">
              <table className="doc-table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Patient</th>
                    <th>MRN</th>
                    <th>Department</th>
                    <th>Doctor</th>
                    <th>Check-in</th>
                    <th>Estimated Wait</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="um-state-cell" colSpan={10}>
                        Loading queue...
                      </td>
                    </tr>
                  ) : sortedAppointments.length === 0 ? (
                    <tr>
                      <td className="um-state-cell" colSpan={10}>
                        No appointments are in the queue for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    sortedAppointments.map((appointment, index) => (
                      <tr className={appointment.id === currentAppointment?.id ? 'queue-current-row' : ''} key={appointment.id}>
                        <td>
                          <span className="queue-token-chip">{tokenFor(appointment, index)}</span>
                        </td>
                        <td>{appointment.patient_name}</td>
                        <td>{appointment.patient_number}</td>
                        <td>{appointment.doctor_specialization}</td>
                        <td>{appointment.doctor_name}</td>
                        <td>{appointment.start_time}</td>
                        <td>{waitMinutes(appointment, index)} min</td>
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
                        <td>
                          <button
                            className="doc-action"
                            onClick={() => navigate(`/patients/profile?id=${encodeURIComponent(appointment.patient_id)}`)}
                            title="Open patient"
                            type="button"
                          >
                            <i className="ph ph-arrow-square-out" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="doc-card appointment-queue-assignment">
            <div className="doc-card-header">
              <div>
                <h3>Queue Summary</h3>
                <p>Live calling controls</p>
              </div>
            </div>
            <div className="appointment-call-display">
              <span>Current Token</span>
              <strong>{currentAppointment ? tokenFor(currentAppointment, currentIndex) : '-'}</strong>
              <p>{currentAppointment?.patient_name ?? 'No patient called'}</p>
            </div>
            <div className="appointment-queue-summary">
              <div className="appointment-queue-stat">
                <span>Next Token</span>
                <strong>{nextAppointment ? tokenFor(nextAppointment, nextIndex) : '-'}</strong>
              </div>
              <div className="appointment-queue-stat">
                <span>Average Wait</span>
                <strong>{averageWait} min</strong>
              </div>
              <div className="appointment-queue-stat">
                <span>Total Waiting</span>
                <strong>{waitingCount}</strong>
              </div>
              <div className="appointment-queue-stat">
                <span>In Consultation</span>
                <strong>{inConsultationCount}</strong>
              </div>
            </div>
            <div className="appointment-call-controls">
              <button className="doc-btn primary" disabled={updating} onClick={handleCallNext} type="button">
                <i className="ph ph-megaphone" aria-hidden="true" />
                Call Next
              </button>
              <button className="doc-btn" disabled={updating} onClick={handleRecall} type="button">
                <i className="ph ph-arrow-clockwise" aria-hidden="true" />
                Recall Patient
              </button>
              <button className="doc-btn" disabled={updating} onClick={handleSkip} type="button">
                <i className="ph ph-skip-forward" aria-hidden="true" />
                Skip Patient
              </button>
              <button className="doc-btn danger-outline" disabled={updating} onClick={handleNoShow} type="button">
                <i className="ph ph-user-minus" aria-hidden="true" />
                Mark No Show
              </button>
              <button className="doc-btn queue-complete" disabled={updating} onClick={handleComplete} type="button">
                <i className="ph ph-check-circle" aria-hidden="true" />
                Complete Visit
              </button>
            </div>
          </aside>
        </section>
      </div>

      {completeOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card queue-complete-modal" aria-labelledby="complete-visit-title">
            <div className="modal-header">
              <h2 id="complete-visit-title">Complete Visit</h2>
              <button className="icon-button" onClick={() => setCompleteOpen(false)} type="button">
                <i className="ph ph-x" aria-hidden="true" />
              </button>
            </div>
            <div className="modal-body">
              <p className="queue-complete-copy">
                {currentAppointment ? `${currentAppointment.patient_name} - ${currentAppointment.patient_number}` : 'Current patient'}
              </p>
              <label className="form-field" htmlFor="completion-note">
                <span>Completion note</span>
                <textarea
                  id="completion-note"
                  onChange={(event) => {
                    setCompletionNote(event.target.value);
                    setCompletionError('');
                  }}
                  placeholder="Document consultation closure, handoff, or next action"
                  rows={4}
                  value={completionNote}
                />
              </label>
              {completionError ? <p className="field-error">{completionError}</p> : null}
            </div>
            <div className="modal-footer">
              <button className="secondary-action" onClick={() => setCompleteOpen(false)} type="button">
                Cancel
              </button>
              <button className="primary-action" onClick={submitCompletion} type="button">
                Complete Visit
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <Toast message={toastMessage} tone={toastTone} visible={toastVisible} />
    </>
  );
}
