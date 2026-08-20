import { useState } from 'react';
import { type ApiAppointmentStatus, type AppointmentResponse } from '../api/appointments';
import { navigate } from '../routing/navigation';
import {
  appointmentPriorityClass,
  appointmentPriorityLabels,
  appointmentStatusClass,
  appointmentStatusLabels,
  todayInputValue,
} from './appointment-utils';
import { useAppointmentQueueFeature, type QueueStatusFilter, type QueuePriorityFilter } from '../hooks/appointments/useAppointmentQueueFeature';
import { toast } from 'sonner';

const waitingStatuses = new Set<ApiAppointmentStatus>(['SCHEDULED', 'CONFIRMED', 'SKIPPED']);

const tokenFor = (appointment: AppointmentResponse, index: number) =>
  `${appointment.priority === 'EMERGENCY' ? 'E' : 'A'}${String(index + 1).padStart(3, '0')}`;

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
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
  const [completionError, setCompletionError] = useState('');

  const {
    state: {
      departmentFilter,
      doctorFilter,
      statusFilter,
      priorityFilter,
      branchFilter,
      queueDate,
      departments,
      doctors,
      branches,
      appointments,
      loading,
      loadError,
      opdLoadError,
      updating,
      currentAppointment,
      nextAppointment,
    },
    actions: {
      setDepartmentFilter,
      setDoctorFilter,
      setStatusFilter,
      setPriorityFilter,
      setBranchFilter,
      setQueueDate,
      handleCallNext,
      handleSkip,
      handleNoShow,
      handleComplete,
    }
  } = useAppointmentQueueFeature();

  const currentIndex = currentAppointment ? appointments.findIndex((appointment) => appointment.id === currentAppointment.id) : -1;
  const nextIndex = nextAppointment ? appointments.findIndex((appointment) => appointment.id === nextAppointment.id) : -1;
  const waitingCount = appointments.filter((appointment) => waitingStatuses.has(appointment.status)).length;
  const inConsultationCount = appointments.filter((appointment) => appointment.status === 'CHECKED_IN').length;
  const completedCount = appointments.filter((appointment) => appointment.status === 'COMPLETED').length;
  const noShowCount = appointments.filter((appointment) => appointment.status === 'NO_SHOW').length;
  const averageWait = waitingCount === 0
    ? 0
    : Math.round(
        appointments
          .filter((appointment) => waitingStatuses.has(appointment.status))
          .reduce((total, appointment, index) => total + waitMinutes(appointment, index), 0) / waitingCount,
      );

  const handleRecall = () => {
    if (!currentAppointment) {
      toast.error('No active patient is currently called.');
      return;
    }
    toast.success(`Recalled ${currentAppointment.patient_name} for token ${tokenFor(currentAppointment, currentIndex)}.`);
  };

  const submitCompletion = async () => {
    if (!completionNote.trim()) {
      setCompletionError('Completion note is required before marking the visit completed.');
      return;
    }
    try {
      await handleComplete(completionNote.trim());
      setCompleteOpen(false);
      toast.success(`Queue token ${currentAppointment?.appointment_number} completed.`);
    } catch (error) {
      setCompletionError(error instanceof Error ? error.message : 'Failed to complete visit.');
    }
  };

  return (
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
              <p>{loading ? 'Loading queue...' : `${appointments.length} queue records`}</p>
            </div>
            <button className="doc-btn" onClick={() => downloadQueue(appointments)} type="button">
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
                ) : appointments.length === 0 ? (
                  <tr>
                    <td className="um-state-cell" colSpan={10}>
                      No appointments are in the queue for the selected filters.
                    </td>
                  </tr>
                ) : (
                  appointments.map((appointment, index) => (
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
            <button className="doc-btn primary" disabled={updating} onClick={() => void handleCallNext()} type="button">
              <i className="ph ph-megaphone" aria-hidden="true" />
              Call Next
            </button>
            <button className="doc-btn" disabled={updating} onClick={handleRecall} type="button">
              <i className="ph ph-arrow-clockwise" aria-hidden="true" />
              Recall Patient
            </button>
            <button className="doc-btn" disabled={updating} onClick={() => void handleSkip()} type="button">
              <i className="ph ph-skip-forward" aria-hidden="true" />
              Skip Patient
            </button>
            <button className="doc-btn danger-outline" disabled={updating} onClick={() => void handleNoShow()} type="button">
              <i className="ph ph-user-minus" aria-hidden="true" />
              Mark No Show
            </button>
            <button className="doc-btn queue-complete" disabled={updating} onClick={() => setCompleteOpen(true)} type="button">
              <i className="ph ph-check-circle" aria-hidden="true" />
              Complete Visit
            </button>
          </div>
        </aside>
      </section>

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
              <button className="primary-action" onClick={() => void submitCompletion()} type="button">
                Complete Visit
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
