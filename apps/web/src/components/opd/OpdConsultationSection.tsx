import type { PatientPreConsultationResponse } from '../../api/opd';

export type ConsultationFormState = {
  chief_complaint: string;
  history_present_illness: string;
  past_history: string;
  family_history: string;
  allergies: string;
  physical_examination: string;
  assessment: string;
  treatment_plan?: string;
  doctor_notes: string;
};

export type OpdConsultationSectionProps = {
  consultationForm: ConsultationFormState;
  setConsultationForm: React.Dispatch<React.SetStateAction<ConsultationFormState>>;
  saveConsultationDraft: () => void;
  handleNextStep: (tab: string) => void;
  canEdit: boolean;
  nextTab?: string;
  preConsultation?: PatientPreConsultationResponse | null;
};

export function OpdConsultationSection({
  consultationForm,
  setConsultationForm,
  saveConsultationDraft,
  handleNextStep,
  canEdit,
  nextTab = 'Diagnosis',
  preConsultation,
}: OpdConsultationSectionProps) {
  return (
    <article className="doc-card opd-tab-card">
      {/* Patient-Reported Information (Read-Only) */}
      <section
        className="opd-form-section patient-reported-section"
        style={{
          marginBottom: '1.5rem',
          background: '#f8fafc',
          padding: '1rem 1.25rem',
          borderRadius: '0.5rem',
          border: '1px solid #e2e8f0',
        }}
      >
        <div
          className="opd-form-section-head"
          style={{
            marginBottom: '0.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>
                Patient-Reported Information
              </h3>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: '#e0f2fe',
                  color: '#0369a1',
                  padding: '0.125rem 0.5rem',
                  borderRadius: '0.25rem',
                  textTransform: 'uppercase',
                }}
              >
                Pre-Consultation (Mobile)
              </span>
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
              {preConsultation?.submitted_at
                ? `Submitted by patient on ${new Date(preConsultation.submitted_at).toLocaleDateString()} at ${new Date(preConsultation.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Information provided by the patient during appointment booking'}
            </p>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
            Read Only
          </span>
        </div>

        {preConsultation &&
        (preConsultation.chief_complaint ||
          preConsultation.history_present_illness ||
          preConsultation.past_medical_history ||
          preConsultation.family_history ||
          preConsultation.allergies) ? (
          <div className="doc-form-grid two" style={{ gap: '0.75rem' }}>
            {preConsultation.chief_complaint ? (
              <div
                className="doc-field"
                style={{
                  background: '#ffffff',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #cbd5e1',
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    color: '#475569',
                    textTransform: 'uppercase',
                  }}
                >
                  Chief Complaint
                </span>
                <p
                  style={{
                    margin: '0.25rem 0 0',
                    fontSize: '0.875rem',
                    color: '#1e293b',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {preConsultation.chief_complaint}
                </p>
              </div>
            ) : null}
            {preConsultation.history_present_illness ? (
              <div
                className="doc-field"
                style={{
                  background: '#ffffff',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #cbd5e1',
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    color: '#475569',
                    textTransform: 'uppercase',
                  }}
                >
                  History of Present Illness
                </span>
                <p
                  style={{
                    margin: '0.25rem 0 0',
                    fontSize: '0.875rem',
                    color: '#1e293b',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {preConsultation.history_present_illness}
                </p>
              </div>
            ) : null}
            {preConsultation.past_medical_history ? (
              <div
                className="doc-field"
                style={{
                  background: '#ffffff',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #cbd5e1',
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    color: '#475569',
                    textTransform: 'uppercase',
                  }}
                >
                  Past Medical History
                </span>
                <p
                  style={{
                    margin: '0.25rem 0 0',
                    fontSize: '0.875rem',
                    color: '#1e293b',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {preConsultation.past_medical_history}
                </p>
              </div>
            ) : null}
            {preConsultation.family_history ? (
              <div
                className="doc-field"
                style={{
                  background: '#ffffff',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #cbd5e1',
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    color: '#475569',
                    textTransform: 'uppercase',
                  }}
                >
                  Family History
                </span>
                <p
                  style={{
                    margin: '0.25rem 0 0',
                    fontSize: '0.875rem',
                    color: '#1e293b',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {preConsultation.family_history}
                </p>
              </div>
            ) : null}
            {preConsultation.allergies ? (
              <div
                className="doc-field full"
                style={{
                  background: '#ffffff',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #fecdd3',
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    color: '#be123c',
                    textTransform: 'uppercase',
                  }}
                >
                  Allergies / Sensitivities
                </span>
                <p
                  style={{
                    margin: '0.25rem 0 0',
                    fontSize: '0.875rem',
                    color: '#9f1239',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {preConsultation.allergies}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div
            style={{
              padding: '0.75rem',
              background: '#ffffff',
              borderRadius: '0.375rem',
              border: '1px dashed #cbd5e1',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '0.8125rem', color: '#94a3b8', fontStyle: 'italic' }}>
              No patient-reported pre-consultation history provided.
            </span>
          </div>
        )}
      </section>

      <section className="opd-form-section">
        <div className="opd-form-section-head">
          <div>
            <h3>Doctor's Clinical Consultation</h3>
            <p>Document presenting complaint and clinical consultation findings</p>
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
            onClick={() => handleNextStep(nextTab)}
            type="button"
          >
            Next: {nextTab}
            <i aria-hidden="true" className="ph ph-arrow-right" />
          </button>
        </div>
      </div>
    </article>
  );
}
