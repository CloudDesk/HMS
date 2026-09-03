export type ReferralDoctorOption = {
  id: string;
  display_name: string;
  specialization?: string | null;
  consultation_room?: string | null;
};

export type OpdReferralSectionProps = {
  referralSpecialty: string;
  setReferralSpecialty: (val: string) => void;
  uniqueSpecialties: string[];
  referralDoctorId: string;
  setReferralDoctorId: (val: string) => void;
  filteredReferralDoctors: ReferralDoctorOption[];
  referralReason: string;
  setReferralReason: (val: string) => void;
  referralBooking: boolean;
  handleSubmitReferral: () => Promise<void>;
  saveConsultationDraft: () => void;
  handleNextStep: (tab: string) => void;
  canEdit: boolean;
};

export function OpdReferralSection({
  referralSpecialty,
  setReferralSpecialty,
  uniqueSpecialties,
  referralDoctorId,
  setReferralDoctorId,
  filteredReferralDoctors,
  referralReason,
  setReferralReason,
  referralBooking,
  handleSubmitReferral,
  saveConsultationDraft,
  handleNextStep,
  canEdit,
}: OpdReferralSectionProps) {
  return (
    <article className="doc-card opd-tab-card">
      <section className="opd-form-section">
        <div className="opd-form-section-head">
          <div>
            <h3>Specialist Referral &amp; Direct Appointment Booking</h3>
            <p>Select specialty, doctor, date and book referral appointment</p>
          </div>
        </div>
        <div className="doc-form-grid two">
          <label className="doc-field" htmlFor="ref-specialty">
            <span>Specialty</span>
            <select
              id="ref-specialty"
              onChange={(e) => {
                setReferralSpecialty(e.target.value);
                setReferralDoctorId('');
              }}
              value={referralSpecialty}
              disabled={!canEdit}
            >
              <option value="">Select Specialty</option>
              {uniqueSpecialties.map((spec) => (
                <option key={spec} value={spec}>
                  {spec}
                </option>
              ))}
            </select>
          </label>

          <label className="doc-field" htmlFor="ref-doctor">
            <span>Referred Doctor</span>
            <select
              disabled={!referralSpecialty || !canEdit}
              id="ref-doctor"
              onChange={(e) => {
                setReferralDoctorId(e.target.value);
              }}
              value={referralDoctorId}
            >
              <option value="">
                {referralSpecialty ? 'Select Doctor' : 'Select a Specialty first'}
              </option>
              {filteredReferralDoctors.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.display_name} — {doc.specialization} ({doc.consultation_room || 'OPD Room'})
                </option>
              ))}
            </select>
          </label>

          <label className="doc-field" htmlFor="ref-reason">
            <span>Reason for Referral</span>
            <input
              id="ref-reason"
              onChange={(e) => setReferralReason(e.target.value)}
              placeholder="e.g. Specialist assessment & second opinion"
              value={referralReason}
              disabled={!canEdit}
            />
          </label>
        </div>
      </section>

      {/* Submit Referral Section */}
      {canEdit && (
        <section className="opd-form-section" style={{ marginTop: '1.25rem' }}>
          <div className="referral-booking-action-bar">
            <button
              className="doc-btn primary"
              disabled={!referralDoctorId || referralBooking}
              onClick={() => void handleSubmitReferral()}
              style={{ minWidth: '220px' }}
              type="button"
            >
              <i aria-hidden="true" className="ph ph-paper-plane-tilt" />
              {referralBooking ? 'Submitting...' : 'Submit Referral'}
            </button>
          </div>
        </section>
      )}

      <div className="opd-sticky-actions">
        <span className="opd-autosave saved">
          <i aria-hidden="true" className="ph ph-check-circle" />
          Auto-save enabled
        </span>
        <div>
          {canEdit && (
            <button className="doc-btn" onClick={saveConsultationDraft} type="button">
              <i aria-hidden="true" className="ph ph-floppy-disk" />
              Save Draft
            </button>
          )}
          <button
            className="doc-btn primary"
            onClick={() => handleNextStep('Follow-up')}
            type="button"
          >
            Next: Follow-up
            <i aria-hidden="true" className="ph ph-arrow-right" />
          </button>
        </div>
      </div>
    </article>
  );
}
