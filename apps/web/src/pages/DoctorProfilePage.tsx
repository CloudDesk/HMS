import { useDoctorProfile } from '../hooks/doctors/useDoctorProfile';
import { navigate, useAppLocation } from '../routing/navigation';
import { formatDate } from './patient-utils';
import { doctorInitials } from './doctor-workflow-utils';

export function DoctorProfilePage() {
  const { search } = useAppLocation();
  const doctorId = new URLSearchParams(search).get('id');
  const profile = useDoctorProfile(doctorId);
  const doctor = profile.doctor;

  if (profile.isLoading) {
    return <div className="doctor-page"><section className="doc-card um-state-cell">Loading doctor profile...</section></div>;
  }

  if (profile.error || !doctor) {
    return (
      <div className="doctor-page">
        <section className="doc-card doctor-empty-state">
          <i className="ph ph-warning-circle" aria-hidden="true" />
          <h3>Doctor profile unavailable</h3>
          <p>{profile.error || 'No doctor profile is mapped to this user.'}</p>
          {profile.canRetry ? (
            <button className="doc-btn" onClick={() => void profile.retry()} type="button">Retry</button>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="doctor-page">
      <section className="doctor-page-header">
        <div className="doctor-page-title">
          <h2>Doctor Profile</h2>
          <p>Practitioner identity, assignment, contact, and recurring working schedule.</p>
        </div>
        <div className="doctor-page-actions">
          {profile.canViewSchedule ? (
            <button className="doc-btn" onClick={() => navigate(`/doctors/schedule?doctor_id=${doctor.id}`)} type="button">
              <i className="ph ph-calendar-check" aria-hidden="true" /> Schedule
            </button>
          ) : null}
          {profile.canViewAvailability ? (
            <button className="doc-btn primary" onClick={() => navigate(`/doctors/availability?doctor_id=${doctor.id}`)} type="button">
              <i className="ph ph-clock" aria-hidden="true" /> Availability
            </button>
          ) : null}
        </div>
      </section>

      <section className="doc-card">
        <div className="doc-summary doctor-profile-summary">
          <span className="doc-avatar doctor-profile-avatar">{doctorInitials(doctor)}</span>
          <div>
            <h3>{doctor.display_name}</h3>
            <p>{doctor.specialization}{doctor.qualification ? ` · ${doctor.qualification}` : ''}</p>
            <div className="doc-summary-meta">
              <span><i className="ph ph-identification-card" aria-hidden="true" /> {doctor.doctor_number}</span>
              <span>{doctor.experience_years ?? 0} years experience</span>
              <span className={`status-badge ${doctor.status === 'ACTIVE' ? 'status-active' : doctor.status === 'ON_LEAVE' ? 'status-warning' : 'status-inactive'}`}>
                {doctor.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="doc-grid two doctor-profile-grid">
        <section className="doc-card">
          <div className="doc-card-header"><div><h3>Professional Details</h3><p>Registration and operational assignment</p></div></div>
          <div className="doc-metric-list">
            <div className="doc-metric"><span>Registration number</span><strong>{doctor.registration_number || 'Not recorded'}</strong></div>
            <div className="doc-metric"><span>Consultation room</span><strong>{doctor.consultation_room || 'Not assigned'}</strong></div>
            <div className="doc-metric"><span>Branch assignment</span><strong>{doctor.branch_id}</strong></div>
            <div className="doc-metric"><span>Department assignment</span><strong>{doctor.department_id}</strong></div>
            <div className="doc-metric"><span>User mapping</span><strong>{doctor.user_id ? profile.userId === doctor.user_id ? 'Current user account' : 'Linked account' : 'Not mapped'}</strong></div>
          </div>
        </section>
        <section className="doc-card">
          <div className="doc-card-header"><div><h3>Contact & Audit</h3><p>Operational contact and record timestamps</p></div></div>
          <div className="doc-metric-list">
            <div className="doc-metric"><span>Phone</span><strong>{doctor.phone || 'Not recorded'}</strong></div>
            <div className="doc-metric"><span>Email</span><strong>{doctor.email || 'Not recorded'}</strong></div>
            <div className="doc-metric"><span>Created</span><strong>{formatDate(doctor.created_at)}</strong></div>
            <div className="doc-metric"><span>Last updated</span><strong>{formatDate(doctor.updated_at)}</strong></div>
            <div className="doc-metric"><span>Notes</span><strong>{doctor.notes || 'No notes recorded'}</strong></div>
          </div>
        </section>
      </div>

      <section className="doc-card">
        <div className="doc-card-header"><div><h3>Weekly Availability</h3><p>Recurring working blocks used by the appointment slot engine</p></div></div>
        <div className="doc-table-wrap">
          <table className="doc-table">
            <thead><tr><th>Day</th><th>Status</th><th>Working blocks</th><th>Slot duration</th></tr></thead>
            <tbody>
              {doctor.availability.map((day) => (
                <tr key={day.day_of_week}>
                  <td><strong>{day.day_of_week}</strong></td>
                  <td><span className={`status-badge ${day.is_available ? 'status-active' : 'status-inactive'}`}>{day.is_available ? 'Available' : 'Off duty'}</span></td>
                  <td>{day.working_blocks.length ? day.working_blocks.map((block) => `${block.start_time}-${block.end_time}`).join(', ') : '-'}</td>
                  <td>{day.working_blocks.length ? Array.from(new Set(day.working_blocks.map(b => b.slot_duration_minutes))).join(', ') + ' minutes' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
