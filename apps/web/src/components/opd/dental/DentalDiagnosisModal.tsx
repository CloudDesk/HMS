import React, { useMemo, useState, useEffect } from 'react';
import {
  GV_BLACK_CLASSIFICATIONS,
  ICD10_DIAGNOSES,
  type Icd10Diagnosis,
} from '../../../data/icd10-diagnoses';
import {
  PERMANENT_QUADRANTS,
  PRIMARY_QUADRANTS,
  TOOTH_NAMES,
} from '../../../pages/dental-utils';
import styles from './DentalExamination.module.css';

export interface DentalDiagnosisModalProps {
  open: boolean;
  onClose: () => void;
  selectedToothNumber: number | null;
  diagnoses: Icd10Diagnosis[];
  onAddDiagnosis?: (dx: Icd10Diagnosis) => void;
  onRemoveDiagnosis?: (code: string, toothNumber?: number | null) => void;
  canEdit: boolean;
  assessment?: string;
  onAssessmentChange?: (val: string) => void;
  showToast?: (message: string, tone?: 'success' | 'error') => void;
}

const COMMON_DENTAL_QUICK_DIAGNOSES = [
  { code: 'K02.9', name: 'Dental caries, unspecified', category: 'Dental & Oral Health' },
  { code: 'K04.0', name: 'Pulpitis (Reversible / Irreversible)', category: 'Dental & Oral Health' },
  { code: 'K04.7', name: 'Periapical abscess without sinus', category: 'Dental & Oral Health' },
  { code: 'K05.10', name: 'Chronic gingivitis, plaque induced', category: 'Dental & Oral Health' },
  { code: 'K05.3', name: 'Chronic periodontitis', category: 'Dental & Oral Health' },
  { code: 'K01.1', name: 'Impacted teeth', category: 'Dental & Oral Health' },
  { code: 'K08.1', name: 'Complete / partial loss of teeth', category: 'Dental & Oral Health' },
  { code: 'K07.4', name: 'Malocclusion, unspecified', category: 'Dental & Oral Health' },
];

export const DentalDiagnosisModal: React.FC<DentalDiagnosisModalProps> = ({
  open,
  onClose,
  selectedToothNumber,
  diagnoses = [],
  onAddDiagnosis,
  onRemoveDiagnosis,
  canEdit,
  assessment = '',
  onAssessmentChange,
  showToast,
}) => {
  const [targetTooth, setTargetTooth] = useState<number | null>(selectedToothNumber);
  const [searchTerm, setSearchTerm] = useState('');

  // Sync initial target tooth when modal opens or selectedToothNumber changes
  useEffect(() => {
    if (open) {
      setTargetTooth(selectedToothNumber);
      setSearchTerm('');
    }
  }, [open, selectedToothNumber]);

  // Handle ESC key press
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const dentalDiagnosesList = useMemo(() => {
    if (!searchTerm.trim()) {
      return ICD10_DIAGNOSES.filter((d) => d.category === 'Dental & Oral Health');
    }
    const q = searchTerm.toLowerCase();
    return ICD10_DIAGNOSES.filter(
      (d) =>
        d.code.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q),
    ).sort((a, b) => {
      const aDental = a.category === 'Dental & Oral Health' ? 0 : 1;
      const bDental = b.category === 'Dental & Oral Health' ? 0 : 1;
      return aDental - bDental;
    });
  }, [searchTerm]);

  if (!open) return null;

  const handleAdd = (dx: Icd10Diagnosis) => {
    if (!canEdit || !onAddDiagnosis) return;
    onAddDiagnosis({
      ...dx,
      tooth_number: targetTooth,
    });
  };

  const handleAddCustom = () => {
    if (!canEdit || !onAddDiagnosis || !searchTerm.trim()) return;
    const customCode = `DX-${Date.now().toString().slice(-4)}`;
    onAddDiagnosis({
      code: customCode,
      name: searchTerm.trim(),
      category: 'Dental & Oral Health',
      tooth_number: targetTooth,
    });
    setSearchTerm('');
    showToast?.(`Custom diagnosis "${searchTerm.trim()}" added.`, 'success');
  };

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dental-dx-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modernModalCard} style={{ width: 'min(820px, calc(100vw - 32px))' }}>
        {/* Header */}
        <div className={styles.modernModalHeader}>
          <div className={styles.modernModalHeaderLeft}>
            <div className={styles.modernModalIcon}>
              <i className="ph ph-stethoscope" aria-hidden="true" />
            </div>
            <div>
              <h3 id="dental-dx-modal-title" className={styles.modernModalTitle}>
                Dental Diagnosis &amp; ICD-10 Coding
              </h3>
              <p className={styles.modernModalSubtitle}>
                Associate ICD-10 conditions, cavity classifications, and diagnostic reasoning with teeth
              </p>
            </div>
          </div>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
            aria-label="Close diagnosis dialog"
          >
            <i className="ph ph-x" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className={styles.modernModalBody}>
          {/* Target Tooth Scope Card */}
          <div
            style={{
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%)',
              borderRadius: '12px',
              border: '1px solid #bbf7d0',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 auto', minWidth: '240px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#dcfce7',
                  border: '1px solid #86efac',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#15803d',
                  fontSize: '1.1rem',
                  flexShrink: 0,
                }}
              >
                <i className="ph ph-tooth" aria-hidden="true" />
              </div>
              <div style={{ flex: '1 1 auto' }}>
                <label
                  htmlFor="modal-dx-tooth-select"
                  style={{
                    display: 'block',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: '#166534',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '3px',
                  }}
                >
                  Target Tooth / Anatomical Scope
                </label>
                <select
                  id="modal-dx-tooth-select"
                  value={targetTooth ?? ''}
                  onChange={(e) => setTargetTooth(e.target.value ? Number(e.target.value) : null)}
                  disabled={!canEdit}
                  style={{
                    width: '100%',
                    padding: '7px 12px',
                    fontSize: '0.84rem',
                    borderRadius: '8px',
                    border: '1px solid #86efac',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    fontWeight: 600,
                    cursor: canEdit ? 'pointer' : 'not-allowed',
                    outline: 'none',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                  }}
                >
                  <option value="">General / Full Mouth (General Dentition)</option>
                  <optgroup label="Permanent Upper Right (Q1: 18 – 11)">
                    {PERMANENT_QUADRANTS.Q1_UPPER_RIGHT.map((num) => (
                      <option key={num} value={num}>
                        Tooth #{num} — {TOOTH_NAMES[num]}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Permanent Upper Left (Q2: 21 – 28)">
                    {PERMANENT_QUADRANTS.Q2_UPPER_LEFT.map((num) => (
                      <option key={num} value={num}>
                        Tooth #{num} — {TOOTH_NAMES[num]}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Permanent Lower Left (Q3: 31 – 38)">
                    {PERMANENT_QUADRANTS.Q3_LOWER_LEFT.map((num) => (
                      <option key={num} value={num}>
                        Tooth #{num} — {TOOTH_NAMES[num]}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Permanent Lower Right (Q4: 41 – 48)">
                    {PERMANENT_QUADRANTS.Q4_LOWER_RIGHT.map((num) => (
                      <option key={num} value={num}>
                        Tooth #{num} — {TOOTH_NAMES[num]}
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
                        Tooth #{num} — {TOOTH_NAMES[num] || `Primary Tooth ${num}`}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {targetTooth !== null ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#dcfce7',
                  border: '1px solid #86efac',
                  padding: '6px 12px',
                  borderRadius: '8px',
                }}
              >
                <i className="ph ph-check-circle" style={{ color: '#15803d', fontSize: '1rem' }} />
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#166534' }}>
                    FDI #{targetTooth}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#15803d' }}>
                    {TOOTH_NAMES[targetTooth] || 'Specific Tooth'}
                  </div>
                </div>
              </div>
            ) : (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  fontWeight: 500,
                }}
              >
                Applies to general oral dentition
              </span>
            )}
          </div>

          {/* G.V. Black Cavity Classification */}
          <div
            style={{
              marginBottom: '18px',
              padding: '14px 16px',
              border: '1px solid #c7d2fe',
              borderRadius: '12px',
              background: 'linear-gradient(180deg, #f8faff 0%, #ffffff 100%)',
              boxShadow: '0 1px 3px rgba(79, 70, 229, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    background: '#e0e7ff',
                    color: '#4338ca',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.9rem',
                  }}
                >
                  <i className="ph ph-selection-all" aria-hidden="true" />
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#312e81' }}>
                  G.V. Black Cavity Classification
                </span>
              </div>
              {targetTooth === null && (
                <span style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 600 }}>
                  Select a specific tooth above to assign classification
                </span>
              )}
            </div>
            <p style={{ margin: '0 0 12px', fontSize: '0.74rem', color: '#64748b' }}>
              Standard clinical classification of carious lesions based on tooth anatomical surface involvement.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '8px',
              }}
            >
              {GV_BLACK_CLASSIFICATIONS.map((classification) => {
                const isAdded = diagnoses.some(
                  (dx) =>
                    dx.code === classification.code &&
                    (dx.tooth_number ?? null) === (targetTooth ?? null),
                );
                return (
                  <button
                    key={classification.code}
                    type="button"
                    disabled={!canEdit || targetTooth === null || isAdded}
                    onClick={() => handleAdd(classification)}
                    title={
                      targetTooth === null
                        ? 'Select a target tooth before adding a cavity classification'
                        : classification.name
                    }
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      padding: '10px 12px',
                      textAlign: 'left',
                      borderRadius: '8px',
                      border: isAdded ? '1.5px solid #16a34a' : '1px solid #e0e7ff',
                      background: isAdded ? '#f0fdf4' : '#ffffff',
                      color: isAdded ? '#166534' : '#1e293b',
                      cursor: canEdit && targetTooth !== null && !isAdded ? 'pointer' : 'not-allowed',
                      opacity: targetTooth === null ? 0.6 : 1,
                      transition: 'all 0.15s ease',
                      boxShadow: isAdded ? '0 1px 4px rgba(22, 163, 74, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 800,
                          color: isAdded ? '#15803d' : '#4338ca',
                          background: isAdded ? '#dcfce7' : '#eef2ff',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {classification.code.replace('GVB-', 'Class ')}
                      </span>
                      {isAdded && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: '#16a34a',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <i className="ph ph-check" aria-hidden="true" /> Added
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.74rem', color: '#475569', lineHeight: 1.35, marginTop: '2px' }}>
                      {classification.name.replace(/^Class [IVX]+\s+—\s+/, '')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick-Add Frequent Dental Diagnoses */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <i className="ph ph-lightning" style={{ color: '#f59e0b', fontSize: '0.95rem' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                Frequent Dental Diagnoses
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {COMMON_DENTAL_QUICK_DIAGNOSES.map((d) => {
                const isAdded = diagnoses.some(
                  (dx) =>
                    dx.code === d.code &&
                    (dx.tooth_number ?? null) === (targetTooth ?? null),
                );
                return (
                  <button
                    key={d.code}
                    type="button"
                    disabled={!canEdit || isAdded}
                    onClick={() => handleAdd(d)}
                    style={{
                      fontSize: '0.75rem',
                      padding: '5px 12px',
                      borderRadius: '20px',
                      border: isAdded ? '1px solid #86efac' : '1px solid #cbd5e1',
                      background: isAdded ? '#f0fdf4' : '#ffffff',
                      color: isAdded ? '#15803d' : '#334155',
                      cursor: canEdit && !isAdded ? 'pointer' : 'default',
                      fontWeight: isAdded ? 700 : 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                    }}
                  >
                    {isAdded ? (
                      <i className="ph ph-check" style={{ color: '#16a34a' }} />
                    ) : (
                      <i className="ph ph-plus" style={{ color: '#64748b' }} />
                    )}
                    <span style={{ fontWeight: 700, color: isAdded ? '#15803d' : '#2563eb' }}>{d.code}</span>
                    <span>{d.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search ICD-10 Catalogue */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label htmlFor="modal-icd-search" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                Search ICD-10 / Condition Catalogue
              </label>
              {canEdit && searchTerm.trim().length > 1 && (
                <button
                  type="button"
                  onClick={handleAddCustom}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <i className="ph ph-plus-circle" /> Add "{searchTerm}" as custom diagnosis
                </button>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <i
                className="ph ph-magnifying-glass"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  fontSize: '0.95rem',
                  pointerEvents: 'none',
                }}
              />
              <input
                id="modal-icd-search"
                type="text"
                className={styles.modalInput}
                placeholder="Search code or condition (e.g. K02, caries, pulpitis, impacted, fracture)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={!canEdit}
                style={{ paddingLeft: '36px' }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '1rem',
                  }}
                >
                  <i className="ph ph-x" />
                </button>
              )}
            </div>

            {/* Search results list */}
            {searchTerm.trim().length > 0 && (
              <div
                style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  marginTop: '6px',
                  background: '#ffffff',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                }}
              >
                {dentalDiagnosesList.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
                    <p style={{ margin: '0 0 8px' }}>No ICD-10 diagnoses matched "{searchTerm}".</p>
                    {canEdit && (
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        onClick={handleAddCustom}
                      >
                        Add "{searchTerm}" as custom diagnosis
                      </button>
                    )}
                  </div>
                ) : (
                  dentalDiagnosesList.slice(0, 20).map((d) => {
                    const isAdded = diagnoses.some(
                      (dx) =>
                        dx.code === d.code &&
                        (dx.tooth_number ?? null) === (targetTooth ?? null),
                    );
                    return (
                      <div
                        key={d.code}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 14px',
                          borderBottom: '1px solid #f1f5f9',
                          fontSize: '0.8rem',
                          background: isAdded ? '#f8fafc' : '#ffffff',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: '#2563eb',
                              background: '#eff6ff',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                            }}
                          >
                            {d.code}
                          </span>
                          <span style={{ color: '#1e293b', fontWeight: 500 }}>{d.name}</span>
                          <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontStyle: 'italic' }}>
                            ({d.category})
                          </span>
                        </div>
                        {canEdit && (
                          <button
                            type="button"
                            disabled={isAdded}
                            onClick={() => handleAdd(d)}
                            style={{
                              fontSize: '0.74rem',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: isAdded ? '1px solid #86efac' : '1px solid #2563eb',
                              background: isAdded ? '#f0fdf4' : '#2563eb',
                              color: isAdded ? '#16a34a' : '#ffffff',
                              cursor: isAdded ? 'default' : 'pointer',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {isAdded ? (
                              <>
                                <i className="ph ph-check" /> Added
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
            )}
          </div>

          {/* Current Diagnoses Record Tray */}
          <div
            style={{
              marginBottom: '18px',
              padding: '14px 16px',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="ph ph-clipboard-text" style={{ color: '#2563eb', fontSize: '0.95rem' }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                  Recorded Diagnoses ({diagnoses.length})
                </span>
              </div>
            </div>
            {diagnoses.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem' }}>
                <i className="ph ph-info" style={{ fontSize: '1.1rem', display: 'block', marginBottom: '4px' }} />
                No diagnoses recorded for this session yet. Select conditions or classifications above to add.
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {diagnoses.map((dx, idx) => (
                  <span
                    key={`${dx.code}-${dx.tooth_number ?? 'gen'}-${idx}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#1e293b',
                      fontSize: '0.78rem',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                    }}
                  >
                    {dx.tooth_number ? (
                      <span
                        style={{
                          background: '#15803d',
                          color: '#ffffff',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                        }}
                      >
                        #{dx.tooth_number}
                      </span>
                    ) : (
                      <span
                        style={{
                          background: '#e2e8f0',
                          color: '#475569',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '0.68rem',
                          fontWeight: 600,
                        }}
                      >
                        General
                      </span>
                    )}
                    <span style={{ fontWeight: 700, color: '#2563eb' }}>{dx.code}</span>
                    <span>{dx.name}</span>
                    {canEdit && onRemoveDiagnosis && (
                      <button
                        type="button"
                        onClick={() => onRemoveDiagnosis(dx.code, dx.tooth_number)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          borderRadius: '4px',
                        }}
                        title="Remove diagnosis"
                        aria-label="Remove diagnosis"
                      >
                        <i className="ph ph-trash" style={{ fontSize: '0.85rem' }} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Diagnostic Reasoning & Clinical Notes */}
          {onAssessmentChange && (
            <div style={{ marginBottom: '8px' }}>
              <label
                htmlFor="modal-dx-notes"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                <i className="ph ph-note-pencil" style={{ color: '#6366f1' }} />
                Diagnostic Reasoning &amp; Clinical Notes
              </label>
              <textarea
                id="modal-dx-notes"
                rows={3}
                className={styles.modalInput}
                placeholder="Clinical reasoning, differential diagnoses, or diagnostic findings..."
                value={assessment}
                onChange={(e) => onAssessmentChange(e.target.value)}
                disabled={!canEdit}
                style={{ resize: 'vertical', minHeight: '70px', lineHeight: 1.4 }}
              />
            </div>
          )}
        </div>

        {/* Sticky Modal Footer */}
        <div className={styles.modernModalFooter}>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            <strong>{diagnoses.length}</strong> {diagnoses.length === 1 ? 'diagnosis' : 'diagnoses'} active in session
          </div>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={onClose}
            style={{ padding: '8px 20px', borderRadius: '8px', fontWeight: 600 }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
