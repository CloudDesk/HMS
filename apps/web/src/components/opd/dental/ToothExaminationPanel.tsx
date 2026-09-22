import React, { useEffect, useState } from 'react';
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
} from '../../../pages/dental-utils';
import { ToothSurfaceSelector } from './ToothSurfaceSelector';
import { ToothImagingPanelSection } from './ToothImagingPanelSection';
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
  additionalContent?: React.ReactNode;
  episodeContext?: {
    episode_number: string | number;
    primary_tooth_number?: number | null;
    diagnosis_name?: string | null;
  } | null;
  toothDiagnoses?: Array<{
    code: string;
    name: string;
    tooth_number?: number | null;
  }>;
  onOpenDiagnosis?: (tooth: number) => void;
  visitId?: string;
  episodeId?: string | null;
  canEdit?: boolean;
  consultationCompleted?: boolean;
  imagingContent?: React.ReactNode;
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
    conditions: [],
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
  additionalContent,
  episodeContext = null,
  toothDiagnoses = [],
  onOpenDiagnosis,
  visitId,
  episodeId,
  canEdit = true,
  consultationCompleted = false,
  imagingContent,
}) => {
  const [activeDetailTab, setActiveDetailTab] = useState<'surfaces' | 'imaging' | 'periodontal'>('surfaces');

  useEffect(() => {
    setActiveDetailTab('surfaces');
  }, [selectedToothNumber]);

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
        {additionalContent}
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
    conditions: [],
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
        conditions: ['MISSING'],
      });
    } else if (status === 'PRESENT') {
      const conds = finding.conditions ?? [];
      const restored = conds.filter((c: string) => c !== 'MISSING');
      onUpdateFinding({
        ...finding,
        status: 'PRESENT',
        conditions: restored.length > 0 ? restored : ['HEALTHY'],
        mobility: finding.mobility ?? 'NONE',
      });
    } else {
      onUpdateFinding({ ...finding, status });
    }
  };

  const toggleCondition = (conditionId: string) => {
    if (disabled) return;
    if (finding.status === 'MISSING' || finding.status === 'EXTRACTED') {
      onUpdateFinding({
        ...finding,
        status: 'PRESENT',
        conditions: [conditionId],
        mobility: finding.mobility ?? 'NONE',
      });
      return;
    }
    const currentConditions = currentFinding?.conditions ?? [];
    let newConditions = [...currentConditions];
    if (newConditions.includes(conditionId)) {
      newConditions = newConditions.filter((c) => c !== conditionId);
    } else {
      if (conditionId === 'HEALTHY') {
        newConditions = ['HEALTHY'];
      } else {
        newConditions = newConditions.filter((c) => c !== 'HEALTHY');
        newConditions.push(conditionId);
      }
    }
    onUpdateFinding({ ...finding, status: 'PRESENT', conditions: newConditions });
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

  const isEpisodeTargetTooth = Boolean(
    episodeContext && episodeContext.primary_tooth_number === selectedToothNumber,
  );

  return (
    <div className={styles.panelContainer}>
      <div className={styles.panelHeader}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className={styles.panelToothBadge}>FDI #{selectedToothNumber}</span>
            {currentFinding ? (
              isAbnormal ? (
                <span className={styles.panelAbnormalBadge}>
                  <i className="ph ph-warning-circle-fill" />
                  {abnormalConditionLabels[0] ?? (finding.status === 'MISSING' ? 'Missing' : 'Abnormal Finding')}
                </span>
              ) : finding.conditions.includes('HEALTHY') ? (
                <span className={styles.panelHealthyBadge}>
                  <i className="ph ph-check-circle" /> Healthy
                </span>
              ) : (
                <span className={styles.panelUnrecordedBadge}>
                  <i className="ph ph-circle-dashed" /> Not Examined
                </span>
              )
            ) : (
              <span className={styles.panelUnrecordedBadge}>
                <i className="ph ph-circle-dashed" /> Not Examined
              </span>
            )}
            {isEpisodeTargetTooth && (
              <span
                className={styles.panelEpisodeToothBadge}
                title={`Primary tooth for Treatment Episode #${episodeContext?.episode_number}${
                  episodeContext?.diagnosis_name ? ` (${episodeContext.diagnosis_name})` : ''
                }`}
              >
                <i className="ph ph-folder-notch-open" /> Episode #{episodeContext?.episode_number} Target Tooth
              </span>
            )}
          </div>
          <div className={styles.panelToothName}>{toothName}</div>
          {toothDiagnoses.length > 0 ? (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px', alignItems: 'center' }}>
              {toothDiagnoses.map((dx) => (
                <span key={dx.code} className={styles.panelDiagnosisTag}>
                  <i className="ph ph-stethoscope" /> {dx.code} — {dx.name}
                </span>
              ))}
              {!disabled && onOpenDiagnosis && (
                <button
                  type="button"
                  className={styles.btnSecondary}
                  style={{ padding: '2px 6px', fontSize: '0.7rem', height: 'auto' }}
                  onClick={() => onOpenDiagnosis(selectedToothNumber)}
                  title="Add or edit diagnosis for this tooth"
                >
                  <i className="ph ph-plus" /> Diagnosis
                </button>
              )}
            </div>
          ) : !disabled && onOpenDiagnosis ? (
            <div style={{ marginTop: '4px' }}>
              <button
                type="button"
                className={styles.btnSecondary}
                style={{ padding: '2px 8px', fontSize: '0.72rem', height: 'auto' }}
                onClick={() => onOpenDiagnosis(selectedToothNumber)}
                title="Add diagnosis for this tooth"
              >
                <i className="ph ph-plus" /> Add Diagnosis
              </button>
            </div>
          ) : null}
          {finding.notes ? <div className={styles.panelToothNotePreview}>{finding.notes}</div> : null}
        </div>
        {!disabled && currentFinding && (
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
      <div className={styles.toothDetailTabs} role="tablist" aria-label="Selected tooth details">
        {([
          ['surfaces', 'Surfaces'],
          ['imaging', 'Imaging'],
          ['periodontal', 'Periodontal'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={activeDetailTab === value}
            className={`${styles.toothDetailTab} ${activeDetailTab === value ? styles.toothDetailTabActive : ''}`}
            onClick={() => setActiveDetailTab(value)}
            disabled={value === 'periodontal' && (finding.status === 'MISSING' || finding.status === 'EXTRACTED')}
          >
            {label}
          </button>
        ))}
      </div>

      {activeDetailTab === 'surfaces' && <>
      {/* Keep surface recording first so the selected-tooth workflow matches the
          workstation: select tooth -> mark surfaces -> record the condition. */}
      {showAffectedSurfaces && finding.status !== 'MISSING' && finding.status !== 'EXTRACTED' ? (
        <div className={`${styles.panelSection} ${styles.panelSurfaceSection}`}>
          <ToothAffectedSurfaces
            selectedToothNumber={selectedToothNumber}
            currentFinding={finding}
            onUpdateFinding={onUpdateFinding}
            disabled={disabled}
          />
        </div>
      ) : null}

      {/* Subsection: STATUS & CONDITION */}
      <div className={styles.panelSection}>
        <div className={styles.panelSectionHeader}>Status &amp; Condition</div>
        <div className={styles.formGroup}>
          {finding.status === 'MISSING' && (
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', marginBottom: '4px' }}>
              Tooth is marked as Missing. Select another condition or Missing again to restore it as present.
            </div>
          )}
          <div className={styles.conditionChipsGrid}>
            {STANDARD_CONDITIONS.map((cond: (typeof STANDARD_CONDITIONS)[number]) => {
              const isSelected = finding.conditions.includes(cond.id);
              const isConditionDisabled = disabled;
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
            <button
              type="button"
              disabled={disabled}
              aria-pressed={finding.status === 'MISSING' || finding.status === 'EXTRACTED'}
              className={`${styles.conditionChip} ${disabled ? styles.chipDisabled : ''}`}
              style={{
                backgroundColor: finding.status === 'MISSING' || finding.status === 'EXTRACTED' ? '#fef2f2' : '#f1f5f9',
                color: finding.status === 'MISSING' || finding.status === 'EXTRACTED' ? '#dc2626' : '#475569',
                borderColor: finding.status === 'MISSING' || finding.status === 'EXTRACTED' ? '#dc2626' : 'transparent',
              }}
              onClick={() => handleStatusChange(
                finding.status === 'MISSING' || finding.status === 'EXTRACTED' ? 'PRESENT' : 'MISSING',
              )}
              title="Mark this tooth as missing"
            >
              Missing
            </button>
          </div>
        </div>
      </div>

      {additionalContent}
      </>}

      {/* Subsection: TOOTH-CENTERED IMAGING TAB */}
      {activeDetailTab === 'imaging' && (
        <div style={{ marginTop: '8px' }}>
          {imagingContent ? (
            imagingContent
          ) : visitId ? (
            <ToothImagingPanelSection
              selectedToothNumber={selectedToothNumber}
              visitId={visitId}
              episodeId={episodeId}
              canEdit={canEdit && !disabled}
              consultationCompleted={consultationCompleted}
              disabled={disabled}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94a3b8', fontSize: '0.82rem' }}>
              <i className="ph ph-camera" style={{ fontSize: '1.8rem', display: 'block', marginBottom: '6px', color: '#cbd5e1' }} />
              Tooth imaging is available when consultation is active.
            </div>
          )}
        </div>
      )}

      {/* Subsection: PERIODONTAL & CLINICAL FINDINGS */}
      {activeDetailTab === 'periodontal' && finding.status !== 'MISSING' && finding.status !== 'EXTRACTED' && (
        <div className={`${styles.panelSection} ${styles.panelPeriodontalSection}`}>
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
      )}
    </div>
  );
};
