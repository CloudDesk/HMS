import type { Icd10Diagnosis } from '../../data/icd10-diagnoses';

export type OpdDiagnosisTabProps = {
  dxSearchTerm: string;
  setDxSearchTerm: (val: string) => void;
  filteredIcd10: Icd10Diagnosis[];
  selectedDiagnoses: Icd10Diagnosis[];
  handleAddDiagnosis: (dx: Icd10Diagnosis) => void;
  handleRemoveDiagnosis: (code: string) => void;
  assessment: string;
  onAssessmentChange: (val: string) => void;
  onSaveDraft: () => void;
  onNext: () => void;
  canEdit: boolean;
  showToast: (msg: string, type: 'success' | 'error') => void;
};

export function OpdDiagnosisTab({
  dxSearchTerm,
  setDxSearchTerm,
  filteredIcd10,
  selectedDiagnoses,
  handleAddDiagnosis,
  handleRemoveDiagnosis,
  assessment,
  onAssessmentChange,
  onSaveDraft,
  onNext,
  canEdit,
  showToast,
}: OpdDiagnosisTabProps) {
  return (
    <article className="doc-card opd-tab-card">
      <section className="opd-form-section">
        <div className="opd-form-section-head">
          <div>
            <h3>Diagnosis Search</h3>
            <p>Search ICD-10 terminology and add diagnoses</p>
          </div>
        </div>

        <div className="opd-dx-search-container">
          <label className="doc-field full" htmlFor="icd-search-input">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
              }}
            >
              <span>Diagnosis / ICD-10 Search</span>
              {canEdit && dxSearchTerm.trim().length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const customCode = `DX-${Date.now().toString().slice(-4)}`;
                    handleAddDiagnosis({
                      code: customCode,
                      name: dxSearchTerm.trim(),
                      category: 'Clinical Diagnosis',
                    });
                    setDxSearchTerm('');
                    showToast(`Custom diagnosis "${dxSearchTerm.trim()}" added.`, 'success');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <i className="ph ph-plus-circle" /> Add "{dxSearchTerm}" as Custom Diagnosis
                </button>
              )}
            </div>
            <div className="opd-dx-search-input-wrap">
              <i className="ph ph-magnifying-glass" aria-hidden="true" />
              <input
                id="icd-search-input"
                className="opd-dx-search-input"
                onChange={(e) => setDxSearchTerm(e.target.value)}
                placeholder="Search code or clinical term (e.g. reflux, hypertension, K21, diabetes)..."
                value={dxSearchTerm}
                disabled={!canEdit}
              />
              {dxSearchTerm ? (
                <button
                  type="button"
                  className="opd-dx-clear-btn"
                  onClick={() => setDxSearchTerm('')}
                  title="Clear search"
                >
                  <i className="ph ph-x" />
                </button>
              ) : null}
            </div>
          </label>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '6px',
              marginBottom: '2px',
              fontSize: '0.75rem',
              color: '#64748b',
            }}
          >
            <span>
              {dxSearchTerm.trim()
                ? `Found ${filteredIcd10.length} matching diagnoses`
                : 'Common Diagnoses (Type in the box above to search full ICD-10 catalogue)'}
            </span>
            {selectedDiagnoses.length > 0 ? (
              <span style={{ color: '#2563eb', fontWeight: 600 }}>
                {selectedDiagnoses.length} diagnosis added
              </span>
            ) : null}
          </div>

          <div className="opd-dx-results-list">
            {filteredIcd10.length === 0 && dxSearchTerm.trim().length > 1 ? (
              <div
                style={{
                  padding: '1.25rem',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px dashed #cbd5e1',
                  textAlign: 'center',
                }}
              >
                <p style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', color: '#475569' }}>
                  No ICD-10 code matched "<strong>{dxSearchTerm}</strong>"
                </p>
                {canEdit && (
                  <button
                    type="button"
                    className="doc-btn primary compact"
                    onClick={() => {
                      const customCode = `DX-${Date.now().toString().slice(-4)}`;
                      handleAddDiagnosis({
                        code: customCode,
                        name: dxSearchTerm.trim(),
                        category: 'Clinical Diagnosis',
                      });
                      setDxSearchTerm('');
                      showToast(`Custom diagnosis "${dxSearchTerm.trim()}" added.`, 'success');
                    }}
                  >
                    <i className="ph ph-plus" /> Add "{dxSearchTerm}" as Custom Diagnosis
                  </button>
                )}
              </div>
            ) : (
              filteredIcd10.map((dx) => {
                const isAdded = selectedDiagnoses.some((d) => d.code === dx.code);
                return (
                  <div className="opd-dx-result-item" key={dx.code}>
                    <div className="opd-dx-item-info">
                      <span className="opd-dx-code-badge">{dx.code}</span>
                      <div className="opd-dx-details-stack">
                        <span className="opd-dx-name">{dx.name}</span>
                        {dx.category ? (
                          <span className="opd-dx-category-label">{dx.category}</span>
                        ) : null}
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        className={`doc-btn compact ${isAdded ? '' : 'primary'}`}
                        disabled={isAdded}
                        onClick={() => handleAddDiagnosis(dx)}
                        style={
                          isAdded
                            ? {
                                background: '#f0fdf4',
                                borderColor: '#bbf7d0',
                                color: '#16a34a',
                                cursor: 'default',
                              }
                            : undefined
                        }
                        type="button"
                      >
                        {isAdded ? (
                          <>
                            <i className="ph-fill ph-check-circle" /> Added
                          </>
                        ) : (
                          <>
                            <i className="ph ph-plus" /> Add
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {selectedDiagnoses.length > 0 ? (
          <div className="opd-dx-chips-container">
            {selectedDiagnoses.map((dx) => (
              <span className="opd-dx-chip" key={dx.code}>
                {dx.code} • {dx.name}
                {canEdit && (
                  <button
                    onClick={() => handleRemoveDiagnosis(dx.code)}
                    title="Remove diagnosis"
                    type="button"
                  >
                    <i aria-hidden="true" className="ph ph-x" />
                  </button>
                )}
              </span>
            ))}
          </div>
        ) : null}

        <div className="doc-form-grid">
          <label className="doc-field full" htmlFor="diagnostic-reasoning">
            <span>Document Diagnostic Reasoning &amp; Clinical Notes</span>
            <textarea
              id="diagnostic-reasoning"
              onChange={(e) => onAssessmentChange(e.target.value)}
              placeholder="Document clinical reasoning, differential diagnoses, or diagnostic findings..."
              rows={3}
              value={assessment}
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
            <button className="doc-btn" onClick={onSaveDraft} type="button">
              <i className="ph ph-floppy-disk" aria-hidden="true" />
              Save Draft
            </button>
          )}
          <button className="doc-btn primary" onClick={onNext} type="button">
            Next: Prescription
            <i aria-hidden="true" className="ph ph-arrow-right" />
          </button>
        </div>
      </div>
    </article>
  );
}
