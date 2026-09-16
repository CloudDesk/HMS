import React, { memo, useState } from 'react';
import type { DentitionType, ToothFinding, ToothSurface } from '../../../api/opd';
import { getToothName, PERMANENT_QUADRANTS, PRIMARY_QUADRANTS } from '../../../pages/dental-utils';
import styles from './DentalExamination.module.css';

interface OdontogramChartProps {
  teeth: ToothFinding[];
  selectedToothNumber: number | null;
  onSelectTooth: (toothNumber: number) => void;
  disabled?: boolean;
}

type Arch = 'upper' | 'lower';
type ToothKind = 'incisor' | 'canine' | 'premolar' | 'molar';

const CURVE_CLASSES = [styles.archCurve0, styles.archCurve1, styles.archCurve2, styles.archCurve3,
  styles.archCurve4, styles.archCurve5, styles.archCurve6, styles.archCurve7] as const;

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
  return finding ? 'healthy' : 'unrecorded';
};

const surfaceClass = (surface: ToothSurface, finding?: ToothFinding) => {
  if (!finding?.surfaces.includes(surface)) return styles.toothSurface;
  if (finding.conditions.includes('CARIOUS')) return `${styles.toothSurface} ${styles.toothSurfaceCaries}`;
  if (finding.conditions.includes('FILLED')) return `${styles.toothSurface} ${styles.toothSurfaceFilled}`;
  if (finding.conditions.includes('CROWN')) return `${styles.toothSurface} ${styles.toothSurfaceCrown}`;
  return `${styles.toothSurface} ${styles.toothSurfaceAttention}`;
};

function ToothShape({ arch, kind, finding }: { arch: Arch; kind: ToothKind; finding?: ToothFinding }) {
  const transform = arch === 'lower' ? 'rotate(180 28 42)' : undefined;
  const crown = kind === 'incisor'
    ? 'M19 35 Q28 30 37 35 L36 60 Q34 70 28 72 Q22 70 20 60 Z'
    : kind === 'canine'
      ? 'M17 37 Q23 31 28 25 Q33 31 39 37 L37 61 Q34 70 28 73 Q22 70 19 61 Z'
      : kind === 'premolar'
        ? 'M14 39 Q19 31 28 33 Q37 31 42 39 L40 62 Q35 71 28 72 Q21 71 16 62 Z'
        : 'M10 40 Q13 31 20 34 Q28 28 36 34 Q43 31 46 40 L44 63 Q38 72 28 72 Q18 72 12 63 Z';
  const roots = kind === 'incisor'
    ? <path d="M22 38 Q21 20 27 6 Q34 20 34 38" />
    : kind === 'canine'
      ? <path d="M21 39 Q22 18 28 4 Q34 18 35 39" />
      : kind === 'premolar'
        ? <><path d="M18 40 Q17 21 21 8 Q27 23 27 40" /><path d="M29 40 Q31 22 37 9 Q40 24 38 40" /></>
        : <><path d="M15 41 Q12 24 16 10 Q23 24 23 41" /><path d="M25 41 Q28 20 32 8 Q36 22 34 41" /><path d="M36 41 Q42 23 43 12 Q47 29 42 42" /></>;
  return <svg className={styles.anatomicalTooth} viewBox="0 0 56 84" aria-hidden="true">
    <g transform={transform}>
      <g className={styles.toothRoots}>{roots}</g>
      <path className={styles.toothCrown} d={crown} />
      <path className={surfaceClass('BUCCAL', finding)} d="M18 41 Q28 35 38 41 L36 48 Q28 44 20 48 Z" />
      <path className={surfaceClass('MESIAL', finding)} d="M18 41 L20 60 L25 55 L25 44 Z" />
      <path className={surfaceClass('DISTAL', finding)} d="M38 41 L36 60 L31 55 L31 44 Z" />
      <path className={surfaceClass('OCCLUSAL', finding)} d="M25 44 L31 44 L31 55 L25 55 Z" />
      <path className={surfaceClass('LINGUAL', finding)} d="M20 60 Q28 67 36 60 L31 55 L25 55 Z" />
      {(finding?.status === 'MISSING' || finding?.status === 'EXTRACTED') && <g className={styles.toothMissingMark}><path d="M13 30 L43 69" /><path d="M43 30 L13 69" /></g>}
      {finding?.status === 'IMPACTED' && <path className={styles.toothImpactedMark} d="M12 55 Q28 76 44 55" />}
      {finding?.conditions.includes('PERIAPICAL_LESION') && <circle className={styles.toothLesionMark} cx="28" cy="8" r="4" />}
    </g>
  </svg>;
}

const ToothButton = memo(function ToothButton({ toothNumber, arch, curve, finding, selected, disabled, onSelect }: {
  toothNumber: number; arch: Arch; curve: number; finding?: ToothFinding; selected: boolean; disabled: boolean;
  onSelect: (toothNumber: number) => void;
}) {
  const condition = conditionFor(finding);
  const conditionClass = `toothCondition${condition[0]?.toUpperCase()}${condition.slice(1)}`;
  const statusText = finding ? `${finding.status}; ${finding.conditions.join(', ')}` : 'No finding recorded';
  return <button type="button"
    className={`${styles.anatomicalToothButton} ${CURVE_CLASSES[curve]} ${selected ? styles.anatomicalToothSelected : ''}`}
    onClick={() => onSelect(toothNumber)} disabled={disabled}
    aria-label={`Tooth ${toothNumber}: ${getToothName(toothNumber)}`} aria-pressed={selected}
    data-fdi={toothNumber} data-condition={condition} data-arch={arch}
    title={`FDI ${toothNumber} — ${getToothName(toothNumber)}\n${statusText}`}>
    {arch === 'upper' && <span className={styles.anatomicalToothNumber}>{toothNumber}</span>}
    <span className={`${styles.anatomicalToothGraphic} ${styles[conditionClass]}`}><ToothShape arch={arch} kind={getKind(toothNumber)} finding={finding} /></span>
    {arch === 'lower' && <span className={styles.anatomicalToothNumber}>{toothNumber}</span>}
    {(finding?.pocket_depth_mm ?? 0) > 3 && <span className={styles.toothClinicalFlag}>{finding?.pocket_depth_mm} mm</span>}
  </button>;
});

function GroupGuide({ primary, arch }: { primary: boolean; arch: Arch }) {
  const labels = primary ? ['Molars', 'Canine', 'Incisors', 'Canine', 'Molars']
    : ['Molars', 'Premolars', 'Canine', 'Incisors', 'Canine', 'Premolars', 'Molars'];
  return <div className={`${styles.toothGroupGuide} ${primary ? styles.toothGroupGuidePrimary : ''}`} aria-label={`${arch === 'upper' ? 'Upper' : 'Lower'} tooth groups`}>
    {labels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
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

export const OdontogramChart: React.FC<OdontogramChartProps> = ({ teeth, selectedToothNumber, onSelectTooth, disabled = false }) => {
  const [dentitionView, setDentitionView] = useState<DentitionType>('PERMANENT');
  const primary = dentitionView === 'PRIMARY';
  const renderArch = (arch: Arch) => {
    const numbers = archTeeth(dentitionView, arch);
    return <section className={styles.anatomicalArch} aria-label={`${arch === 'upper' ? 'Maxillary upper' : 'Mandibular lower'} arch`}>
      <header className={styles.anatomicalArchHeader}><span>Patient right</span><strong>{arch === 'upper' ? 'Maxillary Arch / Upper' : 'Mandibular Arch / Lower'}</strong><span>Patient left</span></header>
      {arch === 'upper' && <GroupGuide primary={primary} arch={arch} />}
      <div className={`${styles.anatomicalArchRow} ${primary ? styles.anatomicalArchRowPrimary : ''} ${arch === 'lower' ? styles.anatomicalArchRowLower : ''}`}>
        {numbers.map((number, index) => <ToothButton key={number} toothNumber={number} arch={arch}
          curve={Math.min(7, Math.floor(Math.abs(index - (numbers.length - 1) / 2)))}
          finding={teeth.find((item) => item.tooth_number === number)} selected={selectedToothNumber === number}
          disabled={disabled} onSelect={onSelectTooth} />)}
        <span className={styles.anatomicalMidline} aria-hidden="true" />
      </div>
      {arch === 'lower' && <GroupGuide primary={primary} arch={arch} />}
    </section>;
  };
  return <div className={styles.odontogramCard}>
    <div className={styles.odontogramTabs} role="tablist" aria-label="Dentition type">
      <button type="button" role="tab" aria-selected={!primary} className={`${styles.odontogramTabBtn} ${!primary ? styles.odontogramTabBtnActive : ''}`} onClick={() => setDentitionView('PERMANENT')}><i className="ph ph-user" aria-hidden="true" /> Permanent Dentition (Adult — 32 Teeth)</button>
      <button type="button" role="tab" aria-selected={primary} className={`${styles.odontogramTabBtn} ${primary ? styles.odontogramTabBtnActive : ''}`} onClick={() => setDentitionView('PRIMARY')}><i className="ph ph-baby" aria-hidden="true" /> Primary / Deciduous (Pediatric — 20 Teeth)</button>
    </div>
    <div className={styles.anatomicalChartViewport}><div className={styles.anatomicalChart} data-testid="anatomical-odontogram">
      <p className={styles.patientPerspective}>Dental chart orientation · patient perspective</p>
      {renderArch('upper')}<div className={styles.archOcclusalGap}><span>Upper</span><span>Midline</span><span>Lower</span></div>{renderArch('lower')}
    </div></div>
    <div className={styles.odontogramLegend} aria-label="Clinical condition legend">
      <span><i className={styles.legendHealthy} />Healthy</span><span><i className={styles.legendCaries} />Caries</span>
      <span><i className={styles.legendFilled} />Restored / Filled</span><span><i className={styles.legendCrown} />Crown</span>
      <span><i className={styles.legendRoot} />Root Piece</span><span><i className={styles.legendMissing}>×</i>Missing</span>
    </div>
  </div>;
};
