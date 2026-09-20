import React, { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { DentitionType, HistoricalToothFinding, ToothFinding } from '../../../api/opd';
import { getToothName, PERMANENT_QUADRANTS, PRIMARY_QUADRANTS } from '../../../pages/dental-utils';
import styles from './DentalExamination.module.css';

interface OdontogramChartProps {
  teeth: ToothFinding[];
  historicalTeeth?: HistoricalToothFinding[];
  selectedToothNumber: number | null;
  onSelectTooth: (toothNumber: number) => void;
  disabled?: boolean;
  defaultDentition?: DentitionType;
  dentition?: DentitionType;
  onDentitionChange?: (dentition: DentitionType) => void;
  patientAge?: number | null;
  visibleArches?: 'both' | 'upper' | 'lower';
  showLegend?: boolean;
}

type Arch = 'upper' | 'lower';
type ToothKind = 'incisor' | 'canine' | 'premolar' | 'molar';

const getKind = (toothNumber: number): ToothKind => {
  const position = toothNumber % 10;
  if (position <= 2) return 'incisor';
  if (position === 3) return 'canine';
  if (position <= 5 && toothNumber < 50) return 'premolar';
  return 'molar';
};

const conditionFor = (finding?: ToothFinding) => {
  if (finding?.status === 'MISSING' || finding?.status === 'EXTRACTED' || finding?.conditions.includes('MISSING')) return 'missing';
  if (finding?.conditions.includes('CARIOUS')) return 'caries';
  if (finding?.conditions.includes('FILLED')) return 'filled';
  if (finding?.conditions.includes('CROWN')) return 'crown';
  if (finding?.conditions.includes('ROOT_PIECE')) return 'root';
  if (finding?.conditions.some((item) => ['FRACTURED', 'PULPITIC', 'PERIAPICAL_LESION'].includes(item))) return 'attention';
  if (finding?.conditions.includes('HEALTHY')) return 'healthy';
  return 'unrecorded';
};


const CROWN_PATHS: Record<ToothKind, string> = {
  incisor: 'M8 9 Q22 3 36 9 C38 18 34 35 27 40 Q22 43 17 40 C10 35 6 18 8 9Z',
  canine: 'M9 11 Q20 1 32 9 C42 20 31 36 22 43 C12 37 3 23 9 11Z',
  premolar: 'M8 8 C15 2 22 6 25 5 C38 2 42 16 38 28 C35 41 25 43 17 39 C5 40 2 20 8 8Z',
  molar: 'M7 8 C13 1 21 6 24 5 C34 1 42 9 40 19 C44 29 37 42 27 40 C19 44 7 40 5 31 C1 24 2 13 7 8Z',
};

function ToothShape({ kind }: { kind: ToothKind }) {
  const id = useId().replace(/:/g, '');
  const posterior = kind === 'premolar' || kind === 'molar';
  return <svg viewBox="0 0 44 46" className={styles.jawCrown} aria-hidden="true">
    <defs>
      <radialGradient id={id} cx="38%" cy="30%" r="75%">
        <stop offset="0" stopColor="#fffdf1" /><stop offset=".48" stopColor="#f8edda" />
        <stop offset=".82" stopColor="#e7cfb2" /><stop offset="1" stopColor="#b99677" />
      </radialGradient>
      <radialGradient id={`${id}-cusp`} cx="35%" cy="25%" r="80%">
        <stop stopColor="#fffef7" /><stop offset=".65" stopColor="#f8efdf" /><stop offset="1" stopColor="#dbc3a7" />
      </radialGradient>
    </defs>
    <path d={CROWN_PATHS[kind]} fill="#ce6861" stroke="#f1b0a0" strokeWidth="4" opacity=".8" />
    <path d={CROWN_PATHS[kind]} fill={`url(#${id})`} stroke="#b69a81" strokeWidth=".8" />
    {posterior ? <g fill={`url(#${id}-cusp)`} stroke="#e3cfb7" strokeWidth=".55">
      {kind === 'premolar' ? <>
        <ellipse cx="14" cy="23" rx="8" ry="14" transform="rotate(-12 14 23)" />
        <ellipse cx="30" cy="23" rx="8" ry="13" transform="rotate(12 30 23)" />
        <path d="M22 11 Q18 22 23 26 L22 35" fill="none" stroke="#baa187" strokeWidth=".8" />
      </> : <>
        <ellipse cx="14" cy="16" rx="8" ry="10" transform="rotate(-18 14 16)" />
        <ellipse cx="30" cy="16" rx="7" ry="9" transform="rotate(18 30 16)" />
        <ellipse cx="14" cy="30" rx="7" ry="8" transform="rotate(20 14 30)" />
        <ellipse cx="29" cy="31" rx="8" ry="8" transform="rotate(-20 29 31)" />
        <path d="M21 12 Q18 21 23 24 Q19 29 22 35 M13 24 Q20 20 31 25" fill="none" stroke="#baa187" strokeWidth=".8" />
      </>}
    </g> : <>
      <path d="M11 12 Q22 7 33 12" fill="none" stroke="#fffef9" strokeWidth="3" strokeLinecap="round" />
      <path d="M15 17 Q14 30 21 36 Q27 32 29 19" fill="none" stroke="#dfcbb2" strokeWidth="1" />
    </>}
    <path d={CROWN_PATHS[kind]} className={styles.jawConditionTint} />
    <path d="M9 14 Q5 24 11 31" fill="none" stroke="#fffdf6" strokeWidth="1.6" strokeLinecap="round" opacity=".8" />
  </svg>;
}

// Coordinates are artwork positions; clinical identifiers come from the existing FDI arrays.
const ADULT_POSITIONS = [[17, 70, -6], [50, 79, -21], [79, 102, -38], [100, 135, -62],
  [112, 172, -76], [120, 210, -83], [124, 250, -87], [126, 290, -90]] as const;
const PRIMARY_POSITIONS = [[21, 72, -8], [58, 94, -28], [88, 132, -52],
  [108, 178, -72], [118, 230, -84]] as const;

const ToothButton = memo(function ToothButton({ toothNumber, arch, finding, hasHistory, selected, disabled, onSelect }: {
  toothNumber: number; arch: Arch; finding?: ToothFinding; hasHistory?: boolean; selected: boolean; disabled: boolean;
  onSelect: (toothNumber: number) => void;
}) {
  const position = (toothNumber >= 50 ? PRIMARY_POSITIONS : ADULT_POSITIONS)[toothNumber % 10 - 1];
  if (!position) return null;
  const [offset, upperY, angle] = position;
  const quadrant = Math.floor(toothNumber / 10);
  const right = [1, 4, 5, 8].includes(quadrant);
  const x = 300 + (right ? -offset : offset);
  const y = arch === 'upper' ? upperY : 360 - upperY;
  const upperRotation = right ? angle : -angle;
  const rotation = arch === 'lower' ? 180 - upperRotation : upperRotation;
  const condition = conditionFor(finding);
  const anterior = toothNumber % 10 <= 2;
  const kind = getKind(toothNumber);
  return <button type="button" className={styles.jawTooth}
    style={{ left: `${x / 6}%`, top: `${y / 3.6}%` }}
    onClick={() => onSelect(toothNumber)} disabled={disabled}
    aria-label={`Tooth ${toothNumber}: ${getToothName(toothNumber)}`} aria-pressed={selected}
    data-fdi={toothNumber} data-condition={condition} data-arch={arch} data-kind={kind}
    data-dentition={toothNumber >= 50 ? 'primary' : 'permanent'}
    data-patient-side={right ? 'right' : 'left'}
    title={`FDI ${toothNumber} — ${getToothName(toothNumber)}\n${finding ? finding.status + '; ' + finding.conditions.join(', ') : 'No finding recorded for current visit'}${hasHistory ? '\n(Has previous visit findings)' : ''}`}>
    <span className={styles.jawToothArt} style={{ transform: `rotate(${rotation}deg)` }}><ToothShape kind={kind} /></span>
    <span className={styles.jawNumber} style={anterior
      ? { left: '50%', top: arch === 'upper' ? '-17px' : 'calc(100% + 3px)', transform: 'translateX(-50%)' }
      : { top: '50%', ...(right ? { right: 'calc(100% - 16px)' } : { left: 'calc(100% - 16px)' }), transform: 'translateY(-50%)' }}>{toothNumber}</span>
    {condition !== 'unrecorded' ? (
      <span className={styles.jawFindingMark} aria-hidden="true">{condition === 'missing' ? '×' : condition === 'healthy' ? '✓' : '•'}</span>
    ) : hasHistory ? (
      <span className={styles.jawFindingMark} style={{ color: '#2563eb', fontWeight: 800 }} title="Has previous visit findings" aria-hidden="true">◷</span>
    ) : null}
    {(finding?.pocket_depth_mm ?? 0) > 3 && <span className={styles.jawPocket}>{finding?.pocket_depth_mm} mm</span>}
  </button>;
});

function GumArtwork({ arch }: { arch: Arch }) {
  const id = useId().replace(/:/g, '');
  return <svg viewBox="0 0 600 360" className={styles.jawGums} aria-hidden="true">
    <defs>
      <radialGradient id={id} cx="50%" cy="45%" r="65%">
        <stop stopColor="#ef9c90" /><stop offset=".5" stopColor="#e97e72" /><stop offset="1" stopColor="#c6504a" />
      </radialGradient>
      <radialGradient id={`${id}-tongue`} cx="50%" cy="70%" r="75%">
        <stop stopColor="#ef9990" /><stop offset="1" stopColor="#d9756d" />
      </radialGradient>
    </defs>
    {arch === 'lower' && <g aria-hidden="true">
      <path d="M192 64 Q300 124 408 64 C405 156 376 271 300 288 C224 271 195 156 192 64Z" fill={`url(#${id}-tongue)`} />
      <path d="M300 135 Q294 196 300 253" fill="none" stroke="#d57770" strokeWidth="2" opacity=".45" />
    </g>}
    <g transform={arch === 'lower' ? 'translate(0 360) scale(1 -1)' : undefined}>
      <path d={arch === 'upper'
        ? 'M300 43 C215 37 165 107 150 207 L148 293 Q147 325 178 322 C226 321 242 276 300 276 C358 276 374 321 422 322 Q453 325 452 293 L450 207 C435 107 385 37 300 43Z'
        : 'M300 43 C215 37 165 107 150 207 L148 293 Q147 325 178 322 Q199 320 196 295 C191 218 220 126 273 106 Q300 95 327 106 C380 126 409 218 404 295 Q401 320 422 322 Q453 325 452 293 L450 207 C435 107 385 37 300 43Z'}
        fill={`url(#${id})`} stroke="#cb7770" strokeWidth="2" />
      <path d="M185 296 C179 221 203 112 265 90 Q300 76 335 90 C397 112 421 221 415 296"
        fill="none" stroke="#f3b4a9" strokeWidth="9" opacity=".5" />
      {arch === 'upper' ? <>
        <path d="M212 278 C207 193 236 128 300 124 C364 128 393 193 388 278 Q346 246 300 248 Q254 246 212 278Z" fill="#dc8079" opacity=".4" />
        {[0, 1, 2, 3, 4].map((index) => <path key={index} d={`M${264 - index * 7} ${143 + index * 13} Q280 ${130 + index * 13} 300 ${135 + index * 13} Q320 ${130 + index * 13} ${336 + index * 7} ${143 + index * 13}`} fill="none" stroke="#f7b2a2" strokeWidth="4" strokeLinecap="round" opacity=".28" />)}
      </> : null}
    </g>
    <text x="300" y={arch === 'upper' ? 231 : 147} textAnchor="middle" fill="#8b4544" fontSize="13" fontWeight="600">{arch === 'upper' ? 'UPPER' : 'LOWER'}</text>
  </svg>;
}

function GroupGuide({ primary, arch }: { primary: boolean; arch: Arch }) {
  const positions = primary ? PRIMARY_POSITIONS : ADULT_POSITIONS;
  const groups = primary
    ? [{ text: 'Canine', first: 3, last: 3 }, { text: 'Molars', first: 4, last: 5 }]
    : [{ text: 'Canine', first: 3, last: 3 }, { text: 'Premolars', first: 4, last: 5 }, { text: 'Molars', first: 6, last: 8 }];
  // Use the tooth artwork coordinates so brackets stay aligned in either dentition.
  const labels = groups.flatMap((group) => {
    const first = positions[group.first - 1];
    const last = positions[group.last - 1];
    if (!first || !last) return [];
    // Leave a visible break between adjacent group brackets.
    const start = first[1] - 10;
    const end = last[1] + 10;
    return [{ ...group, start: arch === 'upper' ? start : 360 - end,
      end: arch === 'upper' ? end : 360 - start }];
  });
  return <div className={styles.jawGuides} aria-label={`${arch === 'upper' ? 'Upper' : 'Lower'} tooth groups`}>
    <svg className={styles.jawGroupBrackets} viewBox="0 0 600 360" aria-hidden="true">
      <path data-tooth-group="Incisors" d={arch === 'upper' ? 'M228 28 V16 H372 V28 M300 16 V12' : 'M228 332 V344 H372 V332 M300 344 V348'} />
      {labels.flatMap(({ text, start, end }) => [true, false].map((right) => {
        const x = right ? 132 : 468;
        const tip = right ? x + 10 : x - 10;
        return <path key={`${text}-${right}`} data-tooth-group={text}
          d={`M${tip} ${start} H${x} V${end} H${tip} M${x} ${(start + end) / 2} h${right ? -4 : 4}`} />;
      }))}
    </svg>
    <span className={styles.jawIncisorGuide} style={{ top: arch === 'upper' ? '-2%' : '97%' }}>Incisors</span>
    {labels.flatMap(({ text, start, end }) => [true, false].map((right) =>
      <span key={`${text}-${right}`} className={styles.jawSideGuide}
        style={{ top: `${(start + end) / 7.2}%`, ...(right ? { right: '79%' } : { left: '79%' }) }}>{text}</span>))}
  </div>;
}

const archTeeth = (dentition: DentitionType, arch: Arch): readonly number[] => {
  if (dentition === 'PERMANENT') return arch === 'upper'
    ? [...PERMANENT_QUADRANTS.Q1_UPPER_RIGHT, ...PERMANENT_QUADRANTS.Q2_UPPER_LEFT]
    : [...PERMANENT_QUADRANTS.Q4_LOWER_RIGHT, ...PERMANENT_QUADRANTS.Q3_LOWER_LEFT];
  return arch === 'upper'
    ? [...PRIMARY_QUADRANTS.Q5_UPPER_RIGHT, ...PRIMARY_QUADRANTS.Q6_UPPER_LEFT]
    : [...PRIMARY_QUADRANTS.Q8_LOWER_RIGHT, ...PRIMARY_QUADRANTS.Q7_LOWER_LEFT];
};

export const OdontogramChart: React.FC<OdontogramChartProps> = ({
  teeth,
  historicalTeeth = [],
  selectedToothNumber,
  onSelectTooth,
  disabled = false,
  defaultDentition = 'PERMANENT',
  dentition: controlledDentition,
  onDentitionChange,
  patientAge = null,
  visibleArches = 'both',
  showLegend = true,
}) => {
  const [internalDentition, setInternalDentition] = useState<DentitionType>(defaultDentition);
  const prevDefaultRef = useRef(defaultDentition);

  const historyTeethSet = useMemo(
    () => new Set((historicalTeeth ?? []).map((t) => t.tooth_number)),
    [historicalTeeth],
  );

  useEffect(() => {
    if (prevDefaultRef.current !== defaultDentition) {
      prevDefaultRef.current = defaultDentition;
      setInternalDentition(defaultDentition);
    }
  }, [defaultDentition]);

  const dentitionView = controlledDentition ?? internalDentition;
  const primary = dentitionView === 'PRIMARY';

  const handleSelectDentition = (type: DentitionType) => {
    if (controlledDentition === undefined) {
      setInternalDentition(type);
    }
    onDentitionChange?.(type);
  };

  const renderArch = (arch: Arch) => {
    const numbers = archTeeth(dentitionView, arch);
    return <section className={styles.jawSection} aria-label={`${arch === 'upper' ? 'Maxillary upper' : 'Mandibular lower'} arch`}>
      <header className={styles.jawHeader}><strong>{arch === 'upper' ? 'Maxillary Arch' : 'Mandibular Arch'}<span>{arch === 'upper' ? '(Upper)' : '(Lower)'}</span></strong></header>
      <div className={styles.jawOrientation}><span>Patient right</span><span>Patient left</span></div>
      <div className={styles.jawStage}>
        <GumArtwork arch={arch} />
        <GroupGuide primary={primary} arch={arch} />
        {numbers.map((number) => <ToothButton key={number} toothNumber={number} arch={arch}
          finding={teeth.find((item) => item.tooth_number === number)}
          hasHistory={historyTeethSet.has(number)}
          selected={selectedToothNumber === number}
          disabled={disabled} onSelect={onSelectTooth} />)}
      </div>
    </section>;
  };
  // Age-aware dentition control:
  // - Adult (patientAge known, defaultDentition=PERMANENT): read-only indicator, no tab group.
  // - Pediatric (patientAge known, defaultDentition=PRIMARY): two buttons; dentist may override to Permanent.
  // - Unknown age (patientAge null): two buttons, existing behaviour.
  const isAdultAutoMode = patientAge !== null && defaultDentition === 'PERMANENT';
  const isPediatricAutoMode = patientAge !== null && defaultDentition === 'PRIMARY';

  const renderDentitionControl = () => {
    if (isAdultAutoMode) {
      // Read-only indicator — not a tab group
      return (
        <div className={styles.dentitionIndicator} aria-label="Dentition type: Permanent Dentition (automatically determined)">
          <i className="ph ph-user" aria-hidden="true" />
          <span>Permanent Dentition (Adult — 32 Teeth)</span>
          <span
            className={styles.dentitionAutoBadge}
            title={`Automatically selected based on patient age (${patientAge} years)`}
          >
            ✓ Auto ({patientAge}y)
          </span>
        </div>
      );
    }

    // Pediatric auto mode: both buttons rendered; Primary is active; dentist may override.
    // Unknown age: both buttons rendered; existing interactive tab group.
    return (
      <div className={styles.odontogramTabs} role="tablist" aria-label="Dentition type">
        <button
          type="button"
          role="tab"
          aria-selected={!primary}
          className={`${styles.odontogramTabBtn} ${!primary ? styles.odontogramTabBtnActive : ''}`}
          onClick={() => handleSelectDentition('PERMANENT')}
        >
          <i className="ph ph-user" aria-hidden="true" />
          <span>Permanent Dentition (Adult — 32 Teeth)</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={primary}
          className={`${styles.odontogramTabBtn} ${primary ? styles.odontogramTabBtnActive : ''}`}
          onClick={() => handleSelectDentition('PRIMARY')}
          title={isPediatricAutoMode ? `Recommended for patient age (${patientAge} yrs)` : undefined}
        >
          <i className="ph ph-baby" aria-hidden="true" />
          <span>Primary / Deciduous (Pediatric — 20 Teeth)</span>
          {isPediatricAutoMode && (
            <span
              className={styles.dentitionAutoBadge}
              title={`Automatically selected based on patient age (${patientAge} years)`}
            >
              ✓ Auto ({patientAge}y)
            </span>
          )}
        </button>
      </div>
    );
  };

  return <div className={styles.odontogramCard}>
    {renderDentitionControl()}
    <div className={styles.anatomicalChartViewport}><div className={styles.jawChart} data-testid="anatomical-odontogram">
      <p className={styles.patientPerspective}>Dental chart orientation · patient perspective</p>
      <p className={styles.chartSelectionHint}>Select a tooth to view its findings and choose affected surfaces below the chart.</p>
      {visibleArches !== 'lower' ? renderArch('upper') : null}
      {visibleArches !== 'upper' ? renderArch('lower') : null}
    </div></div>
    {showLegend ? (
      <div className={styles.odontogramLegend} aria-label="Clinical condition legend">
        <span><i className={styles.legendHealthy} />Healthy</span><span><i className={styles.legendCaries} />Caries</span>
        <span><i className={styles.legendFilled} />Restored / Filled</span><span><i className={styles.legendCrown} />Crown</span>
        <span><i className={styles.legendRoot} />Root Piece</span><span><i className={styles.legendMissing}>×</i>Missing</span>
        {(historicalTeeth?.length ?? 0) > 0 && (
          <span style={{ color: '#2563eb', fontWeight: 600 }}>
            <span style={{ display: 'inline-block', marginRight: '4px', fontSize: '0.85rem' }}>◷</span>
            Prior Visit History ({historicalTeeth?.length})
          </span>
        )}
      </div>
    ) : null}
  </div>;
};
