export type ConsultationFormState = {
  chief_complaint: string;
  history_present_illness: string;
  past_history: string;
  family_history: string;
  allergies: string;
  physical_examination: string;
  assessment: string;
  treatment_plan: string;
  doctor_notes: string;
};

export type OpdConsultationSectionProps = {
  consultationForm: ConsultationFormState;
  setConsultationForm: React.Dispatch<React.SetStateAction<ConsultationFormState>>;
  saveConsultationDraft: () => void;
  handleNextStep: (tab: string) => void;
  canEdit: boolean;
};

export function OpdConsultationSection({
  consultationForm,
  setConsultationForm,
  saveConsultationDraft,
  handleNextStep,
  canEdit,
}: OpdConsultationSectionProps) {
  return (
    <article className="doc-card opd-tab-card">
      <section className="opd-form-section">
        <div className="opd-form-section-head">
          <div>
            <h3>Clinical History</h3>
            <p>Document presenting complaint and relevant clinical history</p>
          </div>
        </div>
        <div className="doc-form-grid two">
          <label className="doc-field" htmlFor="chief-complaint">
            <span>Chief Complaint</span>
            <textarea
              id="chief-complaint"
              onChange={(e) =>
                setConsultationForm((c) => ({ ...c, chief_complaint: e.target.value }))
              }
              rows={3}
              value={consultationForm.chief_complaint}
              disabled={!canEdit}
            />
          </label>
          <label className="doc-field" htmlFor="history-present-illness">
            <span>History of Present Illness</span>
            <textarea
              id="history-present-illness"
              onChange={(e) =>
                setConsultationForm((c) => ({ ...c, history_present_illness: e.target.value }))
              }
              rows={3}
              value={consultationForm.history_present_illness}
              disabled={!canEdit}
            />
          </label>
          <label className="doc-field" htmlFor="past-history">
            <span>Past Medical History</span>
            <textarea
              id="past-history"
              onChange={(e) =>
                setConsultationForm((c) => ({ ...c, past_history: e.target.value }))
              }
              rows={3}
              value={consultationForm.past_history}
              disabled={!canEdit}
            />
          </label>
          <label className="doc-field" htmlFor="family-history">
            <span>Family History</span>
            <textarea
              id="family-history"
              onChange={(e) =>
                setConsultationForm((c) => ({ ...c, family_history: e.target.value }))
              }
              rows={3}
              value={consultationForm.family_history}
              disabled={!canEdit}
            />
          </label>
          <label className="doc-field full" htmlFor="allergies">
            <span>Allergies / Sensitivities</span>
            <textarea
              id="allergies"
              onChange={(e) => setConsultationForm((c) => ({ ...c, allergies: e.target.value }))}
              rows={2}
              value={consultationForm.allergies}
              disabled={!canEdit}
            />
          </label>
        </div>
      </section>

      <section className="opd-form-section">
        <div className="opd-form-section-head">
          <div>
            <h3>Examination &amp; Assessment</h3>
            <p>Document physical findings and treatment plan</p>
          </div>
        </div>
        <div className="doc-form-grid two">
          <label className="doc-field" htmlFor="physical-examination">
            <span>Physical Examination</span>
            <textarea
              id="physical-examination"
              onChange={(e) =>
                setConsultationForm((c) => ({ ...c, physical_examination: e.target.value }))
              }
              rows={3}
              value={consultationForm.physical_examination}
              disabled={!canEdit}
            />
          </label>
          <label className="doc-field" htmlFor="assessment">
            <span>Assessment / Impression</span>
            <textarea
              id="assessment"
              onChange={(e) => setConsultationForm((c) => ({ ...c, assessment: e.target.value }))}
              rows={3}
              value={consultationForm.assessment}
              disabled={!canEdit}
            />
          </label>
          <label className="doc-field full" htmlFor="treatment-plan">
            <span>Treatment Plan &amp; Advice</span>
            <textarea
              id="treatment-plan"
              onChange={(e) =>
                setConsultationForm((c) => ({ ...c, treatment_plan: e.target.value }))
              }
              rows={3}
              value={consultationForm.treatment_plan}
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
              <i aria-hidden="true" className="ph ph-floppy-disk" />
              Save Draft
            </button>
          )}
          <button
            className="doc-btn primary"
            onClick={() => handleNextStep('Diagnosis')}
            type="button"
          >
            Next: Diagnosis
            <i aria-hidden="true" className="ph ph-arrow-right" />
          </button>
        </div>
      </div>
    </article>
  );
}
