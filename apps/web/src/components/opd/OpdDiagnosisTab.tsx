import { useState } from 'react';
import type { Icd10Diagnosis } from '../../data/icd10-diagnoses';
import {
  PERMANENT_QUADRANTS,
  PRIMARY_QUADRANTS,
  TOOTH_NAMES,
} from '../../pages/dental-utils';

export type OpdDiagnosisTabProps = {
  dxSearchTerm: string;
  setDxSearchTerm: (val: string) => void;
  filteredIcd10: Icd10Diagnosis[];
  selectedDiagnoses: Icd10Diagnosis[];
  handleAddDiagnosis: (dx: Icd10Diagnosis) => void;
  handleRemoveDiagnosis: (code: string, toothNumber?: number | null) => void;
  assessment: string;
  onAssessmentChange: (val: string) => void;
  onSaveDraft: () => void;
  onNext: () => void;
  canEdit: boolean;
  showToast: (msg: string, type: 'success' | 'error') => void;
  isDental?: boolean;
  initialTooth?: number | null;
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
  isDental = false,
  initialTooth = null,
}: OpdDiagnosisTabProps) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(isDental ? initialTooth : null);

  const onAddDiagnosis = (dx: Icd10Diagnosis) => {
    handleAddDiagnosis({
      ...dx,
      tooth_number: isDental ? selectedTooth : null,
    });
  };

  const onAddCustomDiagnosis = () => {
    if (!dxSearchTerm.trim()) return;
    const customCode = `DX-${Date.now().toString().slice(-4)}`;
    handleAddDiagnosis({
      code: customCode,
      name: dxSearchTerm.trim(),
      category: isDental ? 'Dental & Oral Health' : 'Clinical Diagnosis',
      tooth_number: isDental ? selectedTooth : null,
    });
    setDxSearchTerm('');
    showToast(`Custom diagnosis "${dxSearchTerm.trim()}" added.`, 'success');
  };

  return (
    <article className="doc-card opd-tab-card">
      <section className="opd-form-section">
        <div className="opd-form-section-head">
          <div>
            <h3>Diagnosis Search</h3>
            <p>
              {isDental
                ? 'Search Dental ICD-10 terminology & associate findings with specific teeth'
                : 'Search ICD-10 terminology and add diagnoses'}
            </p>
          </div>
        </div>

        {/* Dental-Specific Tooth Selector */}
        {isDental && (
          <div
            style={{
              padding: '10px 14px',
              background: '#f0fdf4',
              borderRadius: '8px',
              border: '1px solid #bbf7d0',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <label
              htmlFor="dx-tooth-select"
              style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#166534',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <i className="ph ph-tooth" style={{ fontSize: '1.1rem', color: '#15803d' }} />
              Associate with Tooth (Optional):
            </label>
            <select
              id="dx-tooth-select"
              value={selectedTooth ?? ''}
              onChange={(e) => setSelectedTooth(e.target.value ? Number(e.target.value) : null)}
              disabled={!canEdit}
              style={{
                padding: '6px 12px',
                fontSize: '0.82rem',
                borderRadius: '6px',
                border: '1px solid #86efac',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                fontWeight: 600,
                minWidth: '280px',
                cursor: canEdit ? 'pointer' : 'not-allowed',
              }}
            >
              <option value="">General / Full Mouth (No specific tooth)</option>
              <optgroup label="Permanent Upper Right (Q1: 18 – 11)">
                {PERMANENT_QUADRANTS.Q1_UPPER_RIGHT.map((num) => (
                  <option key={num} value={num}>
                    Tooth #{num} - {TOOTH_NAMES[num]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Permanent Upper Left (Q2: 21 – 28)">
                {PERMANENT_QUADRANTS.Q2_UPPER_LEFT.map((num) => (
                  <option key={num} value={num}>
                    Tooth #{num} - {TOOTH_NAMES[num]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Permanent Lower Left (Q3: 31 – 38)">
                {PERMANENT_QUADRANTS.Q3_LOWER_LEFT.map((num) => (
                  <option key={num} value={num}>
                    Tooth #{num} - {TOOTH_NAMES[num]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Permanent Lower Right (Q4: 41 – 48)">
                {PERMANENT_QUADRANTS.Q4_LOWER_RIGHT.map((num) => (
                  <option key={num} value={num}>
                    Tooth #{num} - {TOOTH_NAMES[num]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Primary / Pediatric Teeth (51 – 85)">
                {[
                  ...PRIMARY_QUADRANTS.Q5_UPPER_RIGHT,
                  ...PRIMARY_QUADRANTS.Q6_UPPER_LEFT,
                  ...PRIMARY_QUADRANTS.Q7_LOWER_LEFT,
                  ...PRIMARY_QUADRANTS.Q8_LOWER_RIGHT,
                ].map((num) => (
                  <option key={num} value={num}>
                    Tooth #{num} - {TOOTH_NAMES[num] || `Primary Tooth ${num}`}
                  </option>
                ))}
              </optgroup>
            </select>
            {selectedTooth !== null ? (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#15803d',
                  background: '#dcfce7',
                  border: '1px solid #86efac',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <i className="ph-fill ph-check-circle" /> Target: Tooth #{selectedTooth}
              </span>
            ) : (
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                (Diagnoses added will apply generally across the oral cavity)
              </span>
            )}
          </div>
        )}

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
                  onClick={onAddCustomDiagnosis}
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
                  {isDental && selectedTooth ? ` (Tooth #${selectedTooth})` : ''}
                </button>
              )}
            </div>
            <div className="opd-dx-search-input-wrap">
              <i className="ph ph-magnifying-glass" aria-hidden="true" />
              <input
                id="icd-search-input"
                className="opd-dx-search-input"
                onChange={(e) => setDxSearchTerm(e.target.value)}
                placeholder={
                  isDental
                    ? 'Search dental codes or terms (e.g. caries, pulpitis, K02, gingivitis, impacted)...'
                    : 'Search code or clinical term (e.g. reflux, hypertension, K21, diabetes)...'
                }
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
                : isDental
                ? 'Common Dental Diagnoses (Type in the box above to search full catalogue)'
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
                  border: '1px solid #cbd5e1',
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
                    onClick={onAddCustomDiagnosis}
                  >
                    <i className="ph ph-plus" /> Add "{dxSearchTerm}" as Custom Diagnosis
                    {isDental && selectedTooth ? ` (Tooth #${selectedTooth})` : ''}
                  </button>
                )}
              </div>
            ) : (
              filteredIcd10.map((dx) => {
                const isAdded = selectedDiagnoses.some(
                  (d) =>
                    d.code === dx.code &&
                    (isDental
                      ? (d.tooth_number ?? null) === (selectedTooth ?? null)
                      : true),
                );
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
                        onClick={() => onAddDiagnosis(dx)}
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
                            {isDental && selectedTooth ? ` (#${selectedTooth})` : ''}
                          </>
                        ) : (
                          <>
                            <i className="ph ph-plus" /> Add
                            {isDental && selectedTooth ? ` (Tooth #${selectedTooth})` : ''}
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
            {selectedDiagnoses.map((dx, idx) => (
              <span
                className="opd-dx-chip"
                key={`${dx.code}-${dx.tooth_number ?? 'gen'}-${idx}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {dx.tooth_number ? (
                  <span
                    style={{
                      background: '#15803d',
                      color: '#ffffff',
                      borderRadius: '4px',
                      padding: '1px 6px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    <i className="ph-fill ph-tooth" style={{ fontSize: '0.75rem' }} /> Tooth #{dx.tooth_number}
                  </span>
                ) : isDental ? (
                  <span
                    style={{
                      background: '#e2e8f0',
                      color: '#475569',
                      borderRadius: '4px',
                      padding: '1px 5px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                    }}
                  >
                    General
                  </span>
                ) : null}
                <strong>{dx.code}</strong> • {dx.name}
                {canEdit && (
                  <button
                    onClick={() => handleRemoveDiagnosis(dx.code, dx.tooth_number)}
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
