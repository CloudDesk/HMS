import React from 'react';
import type {
  HistoricalToothFinding,
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
  historicalFinding?: HistoricalToothFinding | null;
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
  historicalFinding,
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
        conditions: (finding.conditions ?? []).includes('MISSING') ? ['MISSING'] : [],
      });
    } else if (status === 'PRESENT') {
      const conds = finding.conditions ?? [];
      onUpdateFinding({
        ...finding,
        status: 'PRESENT',
        conditions:
          conds.length === 0 || (conds.length === 1 && conds[0] === 'MISSING')
            ? ['HEALTHY']
            : conds.filter((c: string) => c !== 'MISSING'),
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

  const isAbnormal =
    finding.status === 'MISSING' ||
    finding.status === 'EXTRACTED' ||
    (finding.conditions.length > 0 && !finding.conditions.every((c) => c === 'HEALTHY')) ||
    (finding.pocket_depth_mm != null && finding.pocket_depth_mm > 3) ||
    (finding.mobility != null && finding.mobility !== 'NONE') ||
    Boolean(finding.furcation_involvement);

  const abnormalConditionLabels = finding.conditions
    .filter((c) => c !== 'HEALTHY')
    .map((c) => STANDARD_CONDITIONS.find((sc) => sc.id === c)?.label ?? c);

  return (
    <div className={styles.panelContainer}>
      <div className={styles.panelHeader}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className={styles.panelToothBadge}>FDI #{selectedToothNumber}</span>
            {isAbnormal ? (
              <span className={styles.panelAbnormalBadge}>
                <i className="ph ph-warning-circle-fill" />
                {abnormalConditionLabels[0] ?? (finding.status === 'MISSING' ? 'Missing' : 'Abnormal Finding')}
              </span>
            ) : (
              <span className={styles.panelHealthyBadge}>
                <i className="ph ph-check-circle" /> Healthy
              </span>
            )}
          </div>
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

      {/* Historical findings reference card (if any previous visits recorded findings on this tooth) */}
      {historicalFinding && (
        <div
          style={{
            margin: '0 0 16px',
            padding: '12px 14px',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            borderLeft: '4px solid #3b82f6',
          }}
          aria-label="Previous Visit Dental Findings"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="ph ph-clock-counter-clockwise" style={{ color: '#2563eb' }} />
              Previous Visit Findings
            </span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {new Date(historicalFinding.recorded_at).toLocaleDateString()} · Dr. {historicalFinding.doctor_name}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
            {historicalFinding.conditions.map((c) => {
              const label = STANDARD_CONDITIONS.find((sc) => sc.id === c)?.label ?? c;
              return (
                <span
                  key={c}
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.725rem',
                    fontWeight: 600,
                    background: c === 'HEALTHY' ? '#dcfce7' : '#fee2e2',
                    color: c === 'HEALTHY' ? '#166534' : '#991b1b',
                  }}
                >
                  {label}
                </span>
              );
            })}
            {historicalFinding.surfaces.length > 0 && (
              <span style={{ fontSize: '0.725rem', color: '#475569', alignSelf: 'center' }}>
                Surfaces: {historicalFinding.surfaces.join(', ')}
              </span>
            )}
          </div>
          {historicalFinding.notes && (
            <div style={{ fontSize: '0.75rem', color: '#475569', fontStyle: 'italic', marginBottom: '4px' }}>
              Notes: {historicalFinding.notes}
            </div>
          )}
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
            Reference context only (Visit #{historicalFinding.visit_number}). Record fresh findings below.
          </div>
        </div>
      )}

      {/* Subsection: STATUS & CONDITION */}
      <div className={styles.panelSection}>
        <div className={styles.panelSectionHeader}>Status &amp; Condition</div>
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

        <div className={styles.formGroup}>
          <label className={styles.label}>Conditions &amp; Findings</label>
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
      </div>

      {/* Subsection: AFFECTED SURFACES */}
      {showAffectedSurfaces && finding.status !== 'MISSING' && finding.status !== 'EXTRACTED' ? (
        <div className={styles.panelSection}>
          <ToothAffectedSurfaces
            selectedToothNumber={selectedToothNumber}
            currentFinding={finding}
            onUpdateFinding={onUpdateFinding}
            disabled={disabled}
          />
        </div>
      ) : null}

      {/* Subsection: PERIODONTAL & CLINICAL FINDINGS */}
      {finding.status !== 'MISSING' && finding.status !== 'EXTRACTED' && (
        <div className={styles.panelSection}>
          <div className={styles.panelSectionHeader}>Periodontal &amp; Mobility</div>
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
        </div>
      )}

      {/* Subsection: TOOTH NOTES & ACTIONS */}
      <div className={styles.panelSection}>
        <div className={styles.panelSectionHeader}>Tooth Notes &amp; Actions</div>
        <div className={styles.formGroup}>
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
          <button
            type="button"
            className={styles.panelSaveButton}
            onClick={onSave}
            disabled={disabled || isSaving}
            title="Save the dental examination as a draft"
          >
            <i className="ph ph-floppy-disk" aria-hidden="true" />
            {isSaving ? 'Saving Findings...' : 'Save Findings'}
          </button>
        )}
      </div>
    </div>
  );
};
