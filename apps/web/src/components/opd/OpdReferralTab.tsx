interface OpdReferralTabProps {
  uniqueSpecialties: string[];
  filteredReferralDoctors: Array<{ id: string; display_name: string; specialization?: string; consultation_room?: string }>;
  referralSpecialty: string;
  setReferralSpecialty: (val: string) => void;
  referralDoctorId: string;
  setReferralDoctorId: (val: string) => void;
  referralReason: string;
  setReferralReason: (val: string) => void;
  referralBooking: boolean;
  handleSubmitReferral: () => Promise<void>;
  canEdit: boolean;
}

export function OpdReferralTab({
  uniqueSpecialties,
  filteredReferralDoctors,
  referralSpecialty,
  setReferralSpecialty,
  referralDoctorId,
  setReferralDoctorId,
  referralReason,
  setReferralReason,
  referralBooking,
  handleSubmitReferral,
  canEdit,
}: OpdReferralTabProps) {
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
              <i className="ph ph-paper-plane-tilt" aria-hidden="true" />
              {referralBooking ? 'Submitting...' : 'Submit Referral'}
            </button>
          </div>
        </section>
      )}
    </article>
  );
}
