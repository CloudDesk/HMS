import { DoctorSignatureCard } from '../components/doctors/DoctorSignatureCard';
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
          <p>Clinician credentials, department assignment, and working hours.</p>
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

      {/* Section Card 1: Clinician & Contact Information */}
      <section className="doc-card doctor-profile-section-card">
        <div className="doc-card-header">
          <div>
            <h3>Clinician & Contact Details</h3>
            <p>Registration credentials, organizational assignment, and contact information</p>
          </div>
        </div>
        <div className="doctor-profile-columns">
          <div className="doctor-profile-column">
            <div className="doctor-profile-subhead">
              <h4>
                <i className="ph ph-identification-badge" aria-hidden="true" style={{ color: '#2563eb' }} />
                Professional Details
              </h4>
              <p>Clinical registration and department assignment</p>
            </div>
            <div className="doctor-profile-list">
              <div className="doctor-profile-item">
                <span>Registration Number</span>
                <strong>{doctor.registration_number || 'Not recorded'}</strong>
              </div>
              <div className="doctor-profile-item">
                <span>Branch Assignment</span>
                <strong>{profile.branchName}</strong>
              </div>
              <div className="doctor-profile-item">
                <span>Department Assignment</span>
                <strong>{profile.departmentName}</strong>
              </div>
              <div className="doctor-profile-item">
                <span>User Account Mapping</span>
                <strong>
                  {doctor.user_id
                    ? profile.userId === doctor.user_id
                      ? 'Current user account'
                      : 'Linked account'
                    : 'Not mapped'}
                </strong>
              </div>
            </div>
          </div>

          <div className="doctor-profile-column">
            <div className="doctor-profile-subhead">
              <h4>
                <i className="ph ph-address-book" aria-hidden="true" style={{ color: '#2563eb' }} />
                Contact & Audit
              </h4>
              <p>Operational contact and record timestamps</p>
            </div>
            <div className="doctor-profile-list">
              <div className="doctor-profile-item">
                <span>Phone Number</span>
                <strong>{doctor.phone || 'Not recorded'}</strong>
              </div>
              <div className="doctor-profile-item">
                <span>Clinical Email</span>
                <strong>{doctor.email || 'Not recorded'}</strong>
              </div>
              <div className="doctor-profile-item">
                <span>Record Created</span>
                <strong>{formatDate(doctor.created_at)}</strong>
              </div>
              <div className="doctor-profile-item">
                <span>Last Updated</span>
                <strong>{formatDate(doctor.updated_at)}</strong>
              </div>
              <div className="doctor-profile-item">
                <span>Clinical Notes</span>
                <strong>{doctor.notes || 'No notes recorded'}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section Card 2: Clinical Signature & Working Availability */}
      <section className="doc-card doctor-profile-section-card">
        <DoctorSignatureCard
          doctorId={doctor.id}
          signatureData={doctor.signature_data}
          canEdit={profile.canEdit}
          embedded={true}
        />

        <hr className="doctor-profile-divider" />

        <div className="doctor-profile-subhead" style={{ marginBottom: '1rem', borderBottom: 'none' }}>
          <h4>
            <i className="ph ph-calendar-blank" aria-hidden="true" style={{ color: '#2563eb' }} />
            Weekly Availability
          </h4>
          <p>Recurring working slots used by the appointment engine</p>
        </div>

        <div className="doc-table-wrap">
          <table className="doc-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Status</th>
                <th>Working Slots</th>
                <th>Slot Duration</th>
              </tr>
            </thead>
            <tbody>
              {doctor.availability.map((day) => (
                <tr key={day.day_of_week}>
                  <td><strong>{day.day_of_week}</strong></td>
                  <td>
                    <span className={`status-badge ${day.is_available ? 'status-active' : 'status-inactive'}`}>
                      {day.is_available ? 'Available' : 'Off Duty'}
                    </span>
                  </td>
                  <td>
                    {day.working_blocks.length
                      ? day.working_blocks.map((block) => `${block.start_time}-${block.end_time}`).join(', ')
                      : '—'}
                  </td>
                  <td>
                    {day.working_blocks.length
                      ? Array.from(new Set(day.working_blocks.map((b) => b.slot_duration_minutes))).join(', ') + ' minutes'
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
