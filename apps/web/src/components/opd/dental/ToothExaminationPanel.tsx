import React from 'react';
import type {
  ToothFinding,
  ToothMobility,
  ToothStatus,
  ToothSurface,
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
}

export const ToothExaminationPanel: React.FC<ToothExaminationPanelProps> = ({
  selectedToothNumber,
  currentFinding,
  onUpdateFinding,
  onRemoveFinding,
  disabled = false,
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
    onUpdateFinding({ ...finding, status });
  };

  const toggleCondition = (conditionId: string) => {
    if (disabled) return;
    let newConditions = [...finding.conditions];
    if (newConditions.includes(conditionId)) {
      newConditions = newConditions.filter((c: string) => c !== conditionId);
      if (newConditions.length === 0) newConditions = ['HEALTHY'];
    } else {
      // If adding an abnormality, remove 'HEALTHY'
      if (conditionId !== 'HEALTHY') {
        newConditions = newConditions.filter((c: string) => c !== 'HEALTHY');
      } else {
        // If selecting HEALTHY, clear abnormal conditions
        newConditions = ['HEALTHY'];
      }
      newConditions.push(conditionId);
    }
    onUpdateFinding({ ...finding, conditions: newConditions });
  };

  const handleSurfacesChange = (surfaces: ToothSurface[]) => {
    onUpdateFinding({ ...finding, surfaces });
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

  const quickMarkHealthy = () => {
    onUpdateFinding({
      ...finding,
      status: 'PRESENT',
      conditions: ['HEALTHY'],
      surfaces: [],
      mobility: 'NONE',
      pocket_depth_mm: null,
      furcation_involvement: null,
    });
  };

  const quickMarkCarious = () => {
    const conditions = finding.conditions.filter((c: string) => c !== 'HEALTHY');
    if (!conditions.includes('CARIOUS')) conditions.push('CARIOUS');
    onUpdateFinding({
      ...finding,
      status: 'PRESENT',
      conditions,
      surfaces: finding.surfaces.length > 0 ? finding.surfaces : ['OCCLUSAL'],
    });
  };

  const quickMarkMissing = () => {
    onUpdateFinding({
      ...finding,
      status: 'MISSING',
      conditions: ['MISSING'],
      surfaces: [],
      mobility: null,
      pocket_depth_mm: null,
      furcation_involvement: null,
    });
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

      {/* Quick Action Shortcuts */}
      {!disabled && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={styles.btnSecondary}
            style={{ padding: '3px 8px', fontSize: '0.725rem', color: '#16a34a', borderColor: '#bbf7d0' }}
            onClick={quickMarkHealthy}
          >
            <i className="ph ph-check" /> Mark Healthy
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            style={{ padding: '3px 8px', fontSize: '0.725rem', color: '#dc2626', borderColor: '#fecaca' }}
            onClick={quickMarkCarious}
          >
            <i className="ph ph-warning-circle" /> Caries
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            style={{ padding: '3px 8px', fontSize: '0.725rem', color: '#64748b', borderColor: '#e2e8f0' }}
            onClick={quickMarkMissing}
          >
            <i className="ph ph-x-circle" /> Missing
          </button>
        </div>
      )}

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
        </select>
      </div>

      {/* Clinical Conditions */}
      <div className={styles.formGroup}>
        <label className={styles.label}>Conditions & Findings</label>
        <div className={styles.conditionChipsGrid}>
          {STANDARD_CONDITIONS.map((cond: (typeof STANDARD_CONDITIONS)[number]) => {
            const isSelected = finding.conditions.includes(cond.id);
            return (
              <button
                key={cond.id}
                type="button"
                disabled={disabled}
                className={styles.conditionChip}
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
      {finding.status !== 'MISSING' && finding.status !== 'EXTRACTED' && (
        <div className={styles.formGroup}>
          <label className={styles.label}>Affected Surfaces</label>
          <ToothSurfaceSelector
            toothNumber={selectedToothNumber}
            surfaces={finding.surfaces}
            onChange={handleSurfacesChange}
            disabled={disabled}
          />
        </div>
      )}

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
    </div>
  );
};
