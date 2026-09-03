import { MedicalSpinner } from '../ui/MedicalLoader';

export type OpdFollowUpTabProps = {
  followUp: { status?: string } | null;
  followUpDate: string;
  setFollowUpDate: (val: string) => void;
  followUpDoctorId: string;
  setFollowUpDoctorId: (val: string) => void;
  followUpStartTime: string;
  setFollowUpStartTime: (val: string) => void;
  followUpDurationMinutes: string;
  setFollowUpDurationMinutes: (val: string) => void;
  doctors: Array<{ id: string; display_name: string; specialization?: string }>;
  isVisitCompleted: boolean;
  updating: string;
  saveConsultationDraft: () => void;
  scheduleFollowUp: () => void;
  completeConsultation: () => void;
};

export function OpdFollowUpTab({
  followUp,
  followUpDate,
  setFollowUpDate,
  followUpDoctorId,
  setFollowUpDoctorId,
  followUpStartTime,
  setFollowUpStartTime,
  followUpDurationMinutes,
  setFollowUpDurationMinutes,
  doctors,
  isVisitCompleted,
  updating,
  saveConsultationDraft,
  scheduleFollowUp,
  completeConsultation,
}: OpdFollowUpTabProps) {
  return (
    <article className="doc-card opd-tab-card">
      <section className="opd-form-section">
        <div className="opd-form-section-head">
          <div>
            <h3>Follow-up Schedule</h3>
            <p>Book next review date and doctor assignment</p>
          </div>
        </div>
        <div className="doc-form-grid two">
          <label className="doc-field" htmlFor="fu-date">
            <span>Follow-up Date</span>
            <input
              disabled={followUp?.status === 'SCHEDULED'}
              id="fu-date"
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setFollowUpDate(event.target.value)}
              type="date"
              value={followUpDate}
            />
          </label>
          <label className="doc-field" htmlFor="fu-doctor">
            <span>Doctor</span>
            <select
              disabled={followUp?.status === 'SCHEDULED'}
              id="fu-doctor"
              onChange={(event) => setFollowUpDoctorId(event.target.value)}
              value={followUpDoctorId}
            >
              <option value="">Select Doctor</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.display_name} - {d.specialization}
                </option>
              ))}
            </select>
          </label>
          <label className="doc-field" htmlFor="fu-time">
            <span>Start Time</span>
            <input
              disabled={followUp?.status === 'SCHEDULED'}
              id="fu-time"
              onChange={(event) => setFollowUpStartTime(event.target.value)}
              type="time"
              value={followUpStartTime}
            />
          </label>
          <label className="doc-field" htmlFor="fu-duration">
            <span>Duration</span>
            <select
              disabled={followUp?.status === 'SCHEDULED'}
              id="fu-duration"
              onChange={(event) => setFollowUpDurationMinutes(event.target.value)}
              value={followUpDurationMinutes}
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </label>
        </div>
      </section>

      <div className="opd-sticky-actions">
        <span className="opd-autosave saved">
          <i aria-hidden="true" className="ph ph-check-circle" />
          Auto-save enabled
        </span>
        <div>
          <button
            className="doc-btn"
            disabled={isVisitCompleted || updating !== ''}
            onClick={saveConsultationDraft}
            type="button"
          >
            <i aria-hidden="true" className="ph ph-floppy-disk" />
            Save Draft
          </button>
          {followUp?.status === 'SCHEDULED' ? (
            <span
              className="doc-btn"
              style={{
                backgroundColor: '#dcfce7',
                borderColor: '#bbf7d0',
                color: '#15803d',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <i aria-hidden="true" className="ph ph-check-circle-fill" />
              Follow-up Scheduled
            </span>
          ) : (
            <button
              className="doc-btn success"
              disabled={
                updating === 'consultation-complete' ||
                updating === 'follow-up-schedule' ||
                !followUpDate ||
                !followUpDoctorId
              }
              onClick={isVisitCompleted ? scheduleFollowUp : completeConsultation}
              style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
              type="button"
            >
              {updating === 'consultation-complete' || updating === 'follow-up-schedule' ? (
                <>
                  <MedicalSpinner size="sm" />
                  <span>{isVisitCompleted ? 'Scheduling...' : 'Completing...'}</span>
                </>
              ) : (
                <>
                  <i aria-hidden="true" className="ph ph-check-circle" />
                  {isVisitCompleted ? 'Schedule Follow-up' : 'Complete Consultation'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
