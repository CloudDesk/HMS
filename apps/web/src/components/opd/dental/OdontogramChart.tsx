import React, { useState } from 'react';
import type { DentitionType, ToothFinding } from '../../../api/opd';
import {
  getToothName,
  PERMANENT_QUADRANTS,
  PRIMARY_QUADRANTS,
} from '../../../pages/dental-utils';
import styles from './DentalExamination.module.css';

interface OdontogramChartProps {
  teeth: ToothFinding[];
  selectedToothNumber: number | null;
  onSelectTooth: (toothNumber: number) => void;
  disabled?: boolean;
}

export const OdontogramChart: React.FC<OdontogramChartProps> = ({
  teeth,
  selectedToothNumber,
  onSelectTooth,
  disabled = false,
}) => {
  const [dentitionView, setDentitionView] = useState<DentitionType>('PERMANENT');

  const getFinding = (toothNumber: number): ToothFinding | undefined => {
    return teeth.find((t) => t.tooth_number === toothNumber);
  };

  const renderToothCard = (toothNumber: number) => {
    const finding = getFinding(toothNumber);
    const isSelected = selectedToothNumber === toothNumber;
    const toothName = getToothName(toothNumber);

    const isMissing = finding?.status === 'MISSING' || finding?.status === 'EXTRACTED';
    const isImpacted = finding?.status === 'IMPACTED';
    const isCarious = finding?.conditions.includes('CARIOUS');
    const isFilled = finding?.conditions.includes('FILLED');
    const isCrown = finding?.conditions.includes('CROWN');
    const isRootPiece = finding?.conditions.includes('ROOT_PIECE');
    const isFractured = finding?.conditions.includes('FRACTURED');
    const isPulpitic = finding?.conditions.includes('PULPITIC');
    const isPeriapical = finding?.conditions.includes('PERIAPICAL_LESION');
    const hasAbnormality = isCarious || isFilled || isCrown || isRootPiece || isFractured || isPulpitic || isPeriapical;

    // Surface fills
    const surfaces = finding?.surfaces ?? [];
    const getSurfaceFill = (surf: 'BUCCAL' | 'LINGUAL' | 'MESIAL' | 'DISTAL' | 'OCCLUSAL') => {
      if (isMissing) return '#cbd5e1';
      if (surfaces.includes(surf)) {
        if (isCarious) return '#ef4444';
        if (isFilled) return '#3b82f6';
        if (isCrown) return '#f59e0b';
        return '#f97316';
      }
      if (isCrown) return '#fef3c7';
      if (isRootPiece) return '#f3e8ff';
      return '#ffffff';
    };

    return (
      <div
        key={toothNumber}
        className={`${styles.toothCard} ${isSelected ? styles.toothCardSelected : ''}`}
        style={{
          opacity: isMissing ? 0.6 : 1,
          backgroundColor: isMissing ? '#f1f5f9' : undefined,
        }}
        onClick={() => onSelectTooth(toothNumber)}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(event) => {
          if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            onSelectTooth(toothNumber);
          }
        }}
        aria-label={`Tooth ${toothNumber}: ${toothName}`}
        aria-selected={isSelected}
        title={`${toothNumber} — ${toothName}${finding ? `\nStatus: ${finding.status}\nConditions: ${finding.conditions.join(', ')}` : ''}`}
      >
        <span className={styles.toothNumber} style={{ color: isSelected ? '#1d4ed8' : '#334155' }}>
          {toothNumber}
        </span>

        {/* Tooth Surface Mini SVG */}
        <svg className={styles.toothSvg} viewBox="0 0 100 100">
          {/* Outer Border / Crown */}
          <rect x="5" y="5" width="90" height="90" rx="12" fill={isCrown ? '#fef3c7' : '#ffffff'} stroke={isMissing ? '#94a3b8' : '#64748b'} strokeWidth="2" />

          {/* Buccal (Top) */}
          <polygon points="12,12 88,12 70,30 30,30" fill={getSurfaceFill('BUCCAL')} stroke="#94a3b8" strokeWidth="1" />
          {/* Mesial (Left) */}
          <polygon points="12,12 30,30 30,70 12,88" fill={getSurfaceFill('MESIAL')} stroke="#94a3b8" strokeWidth="1" />
          {/* Distal (Right) */}
          <polygon points="88,12 88,88 70,70 70,30" fill={getSurfaceFill('DISTAL')} stroke="#94a3b8" strokeWidth="1" />
          {/* Lingual (Bottom) */}
          <polygon points="30,70 70,70 88,88 12,88" fill={getSurfaceFill('LINGUAL')} stroke="#94a3b8" strokeWidth="1" />
          {/* Occlusal (Center) */}
          <polygon points="30,30 70,30 70,70 30,70" fill={getSurfaceFill('OCCLUSAL')} stroke="#94a3b8" strokeWidth="1" />

          {/* Missing / Extracted cross */}
          {isMissing && (
            <g stroke="#dc2626" strokeWidth="4" strokeLinecap="round">
              <line x1="15" y1="15" x2="85" y2="85" />
              <line x1="85" y1="15" x2="15" y2="85" />
            </g>
          )}

          {/* Impacted symbol */}
          {isImpacted && (
            <text x="50" y="58" textAnchor="middle" fontSize="24" fontWeight="bold" fill="#ea580c">
              IMP
            </text>
          )}

          {/* Periapical lesion apex indicator */}
          {isPeriapical && (
            <circle cx="50" cy="94" r="5" fill="#dc2626" stroke="#ffffff" strokeWidth="1" />
          )}
        </svg>

        {/* Tooth Status Mini Badges */}
        <div className={styles.toothBadgesRow}>
          {isMissing ? (
            <span className={styles.miniBadge} style={{ background: '#f1f5f9', color: '#64748b' }}>
              MISS
            </span>
          ) : isCarious ? (
            <span className={styles.miniBadge} style={{ background: '#fee2e2', color: '#dc2626' }}>
              CAR
            </span>
          ) : isFilled ? (
            <span className={styles.miniBadge} style={{ background: '#dbeafe', color: '#2563eb' }}>
              FILL
            </span>
          ) : isCrown ? (
            <span className={styles.miniBadge} style={{ background: '#fef3c7', color: '#d97706' }}>
              CRN
            </span>
          ) : isRootPiece ? (
            <span className={styles.miniBadge} style={{ background: '#f3e8ff', color: '#9333ea' }}>
              ROOT
            </span>
          ) : hasAbnormality ? (
            <span className={styles.miniBadge} style={{ background: '#fef3c7', color: '#b45309' }}>
              EXP
            </span>
          ) : finding?.status === 'PRESENT' ? (
            <span className={styles.miniDot} style={{ background: '#22c55e' }} title="Healthy" />
          ) : null}

          {/* Pocket depth tag if elevated */}
          {finding?.pocket_depth_mm !== null && finding?.pocket_depth_mm !== undefined && finding.pocket_depth_mm > 3 && (
            <span className={styles.miniBadge} style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '0.55rem' }}>
              {finding.pocket_depth_mm}mm
            </span>
          )}

          {/* Mobility indicator */}
          {finding?.mobility && finding.mobility !== 'NONE' && (
            <span className={styles.miniBadge} style={{ background: '#ffedd5', color: '#c2410c', fontSize: '0.55rem' }}>
              {finding.mobility.replace('GRADE_', 'M:')}
            </span>
          )}
        </div>
      </div>
    );
  };

  const isPermanent = dentitionView === 'PERMANENT';

  return (
    <div className={styles.odontogramCard}>
      {/* View Switcher: Permanent vs Primary */}
      <div className={styles.odontogramTabs}>
        <button
          type="button"
          className={`${styles.odontogramTabBtn} ${isPermanent ? styles.odontogramTabBtnActive : ''}`}
          onClick={() => setDentitionView('PERMANENT')}
        >
          <i className="ph ph-user" style={{ marginRight: '6px' }} />
          Permanent Dentition (Adult &mdash; 32 Teeth)
        </button>
        <button
          type="button"
          className={`${styles.odontogramTabBtn} ${!isPermanent ? styles.odontogramTabBtnActive : ''}`}
          onClick={() => setDentitionView('PRIMARY')}
        >
          <i className="ph ph-baby" style={{ marginRight: '6px' }} />
          Primary / Deciduous (Pediatric &mdash; 20 Teeth)
        </button>
      </div>

      <div className={styles.chartContainer}>
        {/* UPPER ARCH (MAXILLARY) */}
        <div>
          <div className={styles.archHeader}>
            <span>Right (Patient) &mdash; Quadrant {isPermanent ? '1' : '5'}</span>
            <span>Maxillary Arch (Upper)</span>
            <span>Quadrant {isPermanent ? '2' : '6'} &mdash; Left (Patient)</span>
          </div>

          <div className={styles.archGrid} style={{ marginTop: '8px' }}>
            {/* Quadrant 1 or 5 (Upper Right): Back to Front */}
            <div className={styles.quadrantSection}>
              {(isPermanent ? PERMANENT_QUADRANTS.Q1_UPPER_RIGHT : PRIMARY_QUADRANTS.Q5_UPPER_RIGHT).map(
                renderToothCard,
              )}
            </div>

            {/* Midline */}
            <div className={styles.midlineDivider} title="Midline" />

            {/* Quadrant 2 or 6 (Upper Left): Front to Back */}
            <div className={styles.quadrantSection}>
              {(isPermanent ? PERMANENT_QUADRANTS.Q2_UPPER_LEFT : PRIMARY_QUADRANTS.Q6_UPPER_LEFT).map(
                renderToothCard,
              )}
            </div>
          </div>
        </div>

        {/* Arch Horizontal Divider */}
        <div className={styles.horizontalDivider} />

        {/* LOWER ARCH (MANDIBULAR) */}
        <div>
          <div className={styles.archGrid} style={{ marginBottom: '8px' }}>
            {/* Quadrant 4 or 8 (Lower Right): Back to Front */}
            <div className={styles.quadrantSection}>
              {(isPermanent ? PERMANENT_QUADRANTS.Q4_LOWER_RIGHT : PRIMARY_QUADRANTS.Q8_LOWER_RIGHT).map(
                renderToothCard,
              )}
            </div>

            {/* Midline */}
            <div className={styles.midlineDivider} title="Midline" />

            {/* Quadrant 3 or 7 (Lower Left): Front to Back */}
            <div className={styles.quadrantSection}>
              {(isPermanent ? PERMANENT_QUADRANTS.Q3_LOWER_LEFT : PRIMARY_QUADRANTS.Q7_LOWER_LEFT).map(
                renderToothCard,
              )}
            </div>
          </div>

          <div className={styles.archHeader}>
            <span>Right (Patient) &mdash; Quadrant {isPermanent ? '4' : '8'}</span>
            <span>Mandibular Arch (Lower)</span>
            <span>Quadrant {isPermanent ? '3' : '7'} &mdash; Left (Patient)</span>
          </div>
        </div>

        {/* Chart Color Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', justifyContent: 'center', paddingTop: '10px', borderTop: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#64748b' }}>
          <div style={{ display: 'flex', alignContent: 'center', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            <span>Healthy</span>
          </div>
          <div style={{ display: 'flex', alignContent: 'center', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#ef4444', display: 'inline-block' }} />
            <span>Caries</span>
          </div>
          <div style={{ display: 'flex', alignContent: 'center', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#3b82f6', display: 'inline-block' }} />
            <span>Restored / Filled</span>
          </div>
          <div style={{ display: 'flex', alignContent: 'center', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#f59e0b', display: 'inline-block' }} />
            <span>Crown</span>
          </div>
          <div style={{ display: 'flex', alignContent: 'center', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#9333ea', display: 'inline-block' }} />
            <span>Root Piece</span>
          </div>
          <div style={{ display: 'flex', alignContent: 'center', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#cbd5e1', display: 'inline-block', position: 'relative' }}>
              <span style={{ position: 'absolute', top: '-2px', left: '1px', color: '#dc2626', fontWeight: 'bold', fontSize: '8px' }}>✕</span>
            </span>
            <span>Missing</span>
          </div>
        </div>
      </div>
    </div>
  );
};
