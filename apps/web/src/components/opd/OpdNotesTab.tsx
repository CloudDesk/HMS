export type OpdNotesTabProps = {
  doctorNotes: string;
  onDoctorNotesChange: (val: string) => void;
  saveConsultationDraft: () => void;
  handleNextStep: (tab: string) => void;
  canEdit: boolean;
};

export function OpdNotesTab({
  doctorNotes,
  onDoctorNotesChange,
  saveConsultationDraft,
  handleNextStep,
  canEdit,
}: OpdNotesTabProps) {
  return (
    <article className="doc-card opd-tab-card">
      <section className="opd-form-section">
        <div className="opd-form-section-head">
          <div>
            <h3>Encounter Notes &amp; Observations</h3>
            <p>Internal clinical notes and observations</p>
          </div>
        </div>
        <div className="doc-form-grid two">
          <label className="doc-field full" htmlFor="notes-text">
            <span>Doctor Clinical Notes</span>
            <textarea
              id="notes-text"
              onChange={(e) => onDoctorNotesChange(e.target.value)}
              rows={6}
              value={doctorNotes}
              disabled={!canEdit}
            />
          </label>
        </div>
      </section>

      <div className="opd-sticky-actions">
        <span className="opd-autosave saved">
          <i aria-hidden="true" className="ph ph-check-circle" />
          Auto-save enabled
        </span>
        <div>
          {canEdit && (
            <button className="doc-btn" onClick={saveConsultationDraft} type="button">
              Save Notes Draft
            </button>
          )}
          <button
            className="doc-btn primary"
            onClick={() => handleNextStep('Documents')}
            type="button"
          >
            Next: Documents
            <i aria-hidden="true" className="ph ph-arrow-right" />
          </button>
        </div>
      </div>
    </article>
  );
}
