import React from 'react';
import type {
  ToothFinding,
  ToothMobility,
  ToothStatus,
} from '../../../api/opd';
import {
  getDentition,
  getToothName,
  MOBILITY_LEVELS,
  STANDARD_CONDITIONS,
  TOOTH_STATUSES,
} from '../../../pages/dental-utils';
import { ToothSurfaceSelector } from './ToothSurfaceSelector';
import styles from './DentalExamination.module.css';

interface ToothExaminationPanelProps {
  selectedToothNumber: number | null;
  currentFinding: ToothFinding | undefined;
  onUpdateFinding: (finding: ToothFinding) => void;
  onRemoveFinding: (toothNumber: number) => void;
  disabled?: boolean;
  showAffectedSurfaces?: boolean;
  onSave?: () => void;
  isSaving?: boolean;
}

type ToothAffectedSurfacesProps = Pick<
  ToothExaminationPanelProps,
  'selectedToothNumber' | 'currentFinding' | 'onUpdateFinding' | 'disabled'
>;

export const ToothAffectedSurfaces: React.FC<ToothAffectedSurfacesProps> = ({
  selectedToothNumber,
  currentFinding,
  onUpdateFinding,
  disabled = false,
}) => {
  if (!selectedToothNumber) return null;

  const finding: ToothFinding = currentFinding ?? {
    tooth_number: selectedToothNumber,
    dentition: getDentition(selectedToothNumber),
    status: 'PRESENT',
    surfaces: [],
    conditions: ['HEALTHY'],
    mobility: 'NONE',
    pocket_depth_mm: null,
    furcation_involvement: null,
    notes: null,
  };

  if (finding.status === 'MISSING' || finding.status === 'EXTRACTED') return null;

  return (
    <section className={styles.affectedSurfacesPanel} aria-label="Affected Surfaces">
      <div className={styles.affectedSurfacesHeader}>
        <h3 className={styles.affectedSurfacesTitle}>Affected Surfaces</h3>
      </div>
      <ToothSurfaceSelector
        toothNumber={selectedToothNumber}
        surfaces={finding.surfaces}
        onChange={(surfaces) => onUpdateFinding({ ...finding, surfaces })}
        disabled={disabled}
      />
    </section>
  );
};

export const ToothExaminationPanel: React.FC<ToothExaminationPanelProps> = ({
  selectedToothNumber,
  currentFinding,
  onUpdateFinding,
  onRemoveFinding,
  disabled = false,
  showAffectedSurfaces = true,
  onSave,
  isSaving = false,
}) => {
  if (!selectedToothNumber) {
    return (
      <div className={styles.panelContainer}>
        <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b' }}>
          <i className="ph ph-hand-pointing" style={{ fontSize: '2rem', display: 'block', marginBottom: '8px', color: '#94a3b8' }} />
          <strong>Select a Tooth</strong>
          <p style={{ fontSize: '0.8rem', margin: '4px 0 0', color: '#94a3b8' }}>
            Click any tooth on the odontogram to record clinical findings, surfaces, and periodontal status.
          </p>
        </div>
      </div>
    );
  }

  const toothName = getToothName(selectedToothNumber);
  const dentition = getDentition(selectedToothNumber);

  // Derive existing or default finding
  const finding: ToothFinding = currentFinding ?? {
    tooth_number: selectedToothNumber,
    dentition,
    status: 'PRESENT',
    surfaces: [],
    conditions: ['HEALTHY'],
    mobility: 'NONE',
    pocket_depth_mm: null,
    furcation_involvement: null,
    notes: null,
  };

  const handleStatusChange = (status: ToothStatus) => {
    if (status === 'MISSING') {
      onUpdateFinding({
        ...finding,
        status: 'MISSING',
        surfaces: [],
        mobility: null,
        pocket_depth_mm: null,
        furcation_involvement: null,
        conditions: finding.conditions.includes('MISSING') ? ['MISSING'] : [],
      });
    } else if (status === 'PRESENT') {
      onUpdateFinding({
        ...finding,
        status: 'PRESENT',
        conditions:
          finding.conditions.length === 0 ||
          (finding.conditions.length === 1 && finding.conditions[0] === 'MISSING')
            ? ['HEALTHY']
            : finding.conditions.filter((c: string) => c !== 'MISSING'),
        mobility: finding.mobility ?? 'NONE',
      });
    } else {
      onUpdateFinding({ ...finding, status });
    }
  };

  const toggleCondition = (conditionId: string) => {
    if (disabled || finding.status === 'MISSING') return;
    let newConditions = [...finding.conditions];
    if (newConditions.includes(conditionId)) {
      newConditions = newConditions.filter((c: string) => c !== conditionId);
      if (newConditions.length === 0) newConditions = ['HEALTHY'];
    } else {
      if (conditionId === 'HEALTHY') {
        newConditions = ['HEALTHY'];
      } else {
        newConditions = newConditions.filter((c: string) => c !== 'HEALTHY');
        newConditions.push(conditionId);
      }
    }
    onUpdateFinding({ ...finding, conditions: newConditions });
  };

  const handleMobilityChange = (mobility: ToothMobility) => {
    onUpdateFinding({ ...finding, mobility });
  };

  const handlePocketDepthChange = (val: string) => {
    const num = val === '' ? null : Number(val);
    if (num !== null && (num < 0 || num > 20)) return;
    onUpdateFinding({ ...finding, pocket_depth_mm: num });
  };

  const handleNotesChange = (val: string) => {
    onUpdateFinding({ ...finding, notes: val.trim() || null });
  };

  const handleFurcationChange = (val: string) => {
    onUpdateFinding({ ...finding, furcation_involvement: val.trim() || null });
  };

  return (
    <div className={styles.panelContainer}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.panelToothBadge}>FDI #{selectedToothNumber}</div>
          <div className={styles.panelToothName}>{toothName}</div>
        </div>
        {!disabled && (
          <button
            type="button"
            className={styles.btnSecondary}
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            onClick={() => onRemoveFinding(selectedToothNumber)}
            title="Remove findings for this tooth"
          >
            <i className="ph ph-trash" /> Reset
          </button>
        )}
      </div>

      {/* Tooth Status */}
      <div className={styles.formGroup}>
        <label className={styles.label}>Tooth Status</label>
        <select
          className={styles.select}
          value={finding.status}
          onChange={(e) => handleStatusChange(e.target.value as ToothStatus)}
          disabled={disabled}
        >
          {TOOTH_STATUSES.map((st: (typeof TOOTH_STATUSES)[number]) => (
            <option key={st.value} value={st.value}>
              {st.label}
            </option>
          ))}
          {!TOOTH_STATUSES.some((st) => st.value === finding.status) && (
            <option value={finding.status}>{finding.status}</option>
          )}
        </select>
      </div>

      {/* Clinical Conditions */}
      <div className={styles.formGroup}>
        <label className={styles.label}>Conditions & Findings</label>
        {finding.status === 'MISSING' && (
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', marginBottom: '4px' }}>
            Tooth is marked as Missing. Set Tooth Status to &ldquo;Present&rdquo; to record clinical conditions.
          </div>
        )}
        <div className={styles.conditionChipsGrid}>
          {STANDARD_CONDITIONS.map((cond: (typeof STANDARD_CONDITIONS)[number]) => {
            const isSelected = finding.conditions.includes(cond.id);
            const isConditionDisabled = disabled || finding.status === 'MISSING';
            return (
              <button
                key={cond.id}
                type="button"
                disabled={isConditionDisabled}
                className={`${styles.conditionChip} ${isConditionDisabled ? styles.chipDisabled : ''}`}
                style={{
                  backgroundColor: isSelected ? cond.badgeBg : '#f1f5f9',
                  color: isSelected ? cond.color : '#475569',
                  borderColor: isSelected ? cond.color : 'transparent',
                }}
                onClick={() => toggleCondition(cond.id)}
                title={cond.description}
              >
                {cond.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Affected Surfaces */}
      {showAffectedSurfaces ? (
        <ToothAffectedSurfaces
          selectedToothNumber={selectedToothNumber}
          currentFinding={finding}
          onUpdateFinding={onUpdateFinding}
          disabled={disabled}
        />
      ) : null}

      {/* Periodontal Probing & Mobility */}
      {finding.status !== 'MISSING' && finding.status !== 'EXTRACTED' && (
        <div className={styles.formGrid2}>
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Probing Depth (mm)
              {finding.pocket_depth_mm != null && finding.pocket_depth_mm > 3 && (
                <span style={{ color: '#dc2626', fontSize: '0.7rem' }}> (Deep Pocket)</span>
              )}
            </label>
            <input
              type="number"
              min="0"
              max="20"
              step="1"
              placeholder="0 - 20 mm"
              className={styles.input}
              value={finding.pocket_depth_mm ?? ''}
              onChange={(e) => handlePocketDepthChange(e.target.value)}
              disabled={disabled}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Tooth Mobility</label>
            <select
              className={styles.select}
              value={finding.mobility ?? 'NONE'}
              onChange={(e) => handleMobilityChange(e.target.value as ToothMobility)}
              disabled={disabled}
            >
              {MOBILITY_LEVELS.map((m: (typeof MOBILITY_LEVELS)[number]) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Furcation Involvement */}
      {finding.status !== 'MISSING' && finding.status !== 'EXTRACTED' && (
        <div className={styles.formGroup}>
          <label className={styles.label}>Furcation Involvement</label>
          <select
            className={styles.select}
            value={finding.furcation_involvement ?? ''}
            onChange={(e) => handleFurcationChange(e.target.value)}
            disabled={disabled}
          >
            <option value="">None / Not Applicable</option>
            <option value="Class I (Incipient / Early)">Class I (Incipient / Early)</option>
            <option value="Class II (Moderate / Partial)">Class II (Moderate / Partial)</option>
            <option value="Class III (Through-and-Through)">Class III (Through-and-Through)</option>
            <option value="Class IV (Through-and-Through, Clinically Exposed)">Class IV (Through-and-Through, Clinically Exposed)</option>
          </select>
        </div>
      )}

      {/* Tooth Notes */}
      <div className={styles.formGroup}>
        <label className={styles.label}>Tooth Notes</label>
        <textarea
          className={styles.textarea}
          placeholder="Specific clinical notes for this tooth..."
          value={finding.notes ?? ''}
          onChange={(e) => handleNotesChange(e.target.value)}
          disabled={disabled}
          rows={2}
        />
      </div>
      {onSave && (
        <button type="button" className={styles.panelSaveButton} onClick={onSave} disabled={disabled || isSaving}
          title="Save the dental examination as a draft">
          <i className="ph ph-floppy-disk" aria-hidden="true" />
          {isSaving ? 'Saving Findings...' : 'Save Findings'}
        </button>
      )}
    </div>
  );
};
