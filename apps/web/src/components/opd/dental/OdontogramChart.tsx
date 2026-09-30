import React, { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { DentitionType, HistoricalToothFinding, ToothFinding } from '../../../api/opd';
import { getToothName, PERMANENT_QUADRANTS, PRIMARY_QUADRANTS } from '../../../pages/dental-utils';
import { AnatomicalMouthBackground, AnatomicalMouthForeground } from './AnatomicalMouthArtwork';
import type { AnatomicalCallout, OralCavity3DController } from './dental-3d-scene';
import styles from './DentalExamination.module.css';

interface OdontogramChartProps {
  teeth: ToothFinding[];
  historicalTeeth?: HistoricalToothFinding[];
  selectedToothNumber: number | null;
  onSelectTooth: (toothNumber: number) => void;
  disabled?: boolean;
  defaultDentition?: DentitionType;
  dentition?: DentitionType;
  patientAge?: number | null;
  visibleArches?: 'both' | 'upper' | 'lower';
  showLegend?: boolean;
}

type Arch = 'upper' | 'lower';
type ToothKind = 'incisor' | 'canine' | 'premolar' | 'molar';
type ViewMode = '2d' | '3d';

const CALLOUT_ORDER: Record<'left' | 'right', string[]> = {
  left: ['central-incisor', 'lateral-incisor', 'canine', 'premolar', 'molar', 'uvula', 'cheek', 'tongue'],
  right: ['upper-lip', 'hard-palate', 'soft-palate', 'fauces', 'lower-lip'],
};
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
  return (
    <svg viewBox="0 0 44 46" className={styles.jawCrown} aria-hidden="true">
      <defs>
        <radialGradient id={id} cx="38%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fffdf1" />
          <stop offset=".48" stopColor="#f8edda" />
          <stop offset=".82" stopColor="#e7cfb2" />
          <stop offset="1" stopColor="#b99677" />
        </radialGradient>
        <radialGradient id={`${id}-cusp`} cx="35%" cy="25%" r="80%">
          <stop stopColor="#fffef7" />
          <stop offset=".65" stopColor="#f8efdf" />
          <stop offset="1" stopColor="#dbc3a7" />
        </radialGradient>
      </defs>
      <path d={CROWN_PATHS[kind]} fill="#ce6861" stroke="#f1b0a0" strokeWidth="4" opacity=".8" />
      <path d={CROWN_PATHS[kind]} fill={`url(#${id})`} stroke="#b69a81" strokeWidth=".8" />
      {posterior ? (
        <g fill={`url(#${id}-cusp)`} stroke="#e3cfb7" strokeWidth=".55">
          {kind === 'premolar' ? (
            <>
              <ellipse cx="14" cy="23" rx="8" ry="14" transform="rotate(-12 14 23)" />
              <ellipse cx="30" cy="23" rx="8" ry="13" transform="rotate(12 30 23)" />
              <path d="M22 11 Q18 22 23 26 L22 35" fill="none" stroke="#baa187" strokeWidth=".8" />
            </>
          ) : (
            <>
              <ellipse cx="14" cy="16" rx="8" ry="10" transform="rotate(-18 14 16)" />
              <ellipse cx="30" cy="16" rx="7" ry="9" transform="rotate(18 30 16)" />
              <ellipse cx="14" cy="30" rx="7" ry="8" transform="rotate(20 14 30)" />
              <ellipse cx="29" cy="31" rx="8" ry="8" transform="rotate(-20 29 31)" />
              <path d="M21 12 Q18 21 23 24 Q19 29 22 35 M13 24 Q20 20 31 25" fill="none" stroke="#baa187" strokeWidth=".8" />
            </>
          )}
        </g>
      ) : (
        <>
          <path d="M11 12 Q22 7 33 12" fill="none" stroke="#fffef9" strokeWidth="3" strokeLinecap="round" />
          <path d="M15 17 Q14 30 21 36 Q27 32 29 19" fill="none" stroke="#dfcbb2" strokeWidth="1" />
        </>
      )}
      <path d={CROWN_PATHS[kind]} className={styles.jawConditionTint} />
      <path d="M9 14 Q5 24 11 31" fill="none" stroke="#fffdf6" strokeWidth="1.6" strokeLinecap="round" opacity=".8" />
    </svg>
  );
}

// Coordinates are artwork positions; clinical identifiers come from the existing FDI arrays.
const ADULT_POSITIONS = [
  [17, 70, -6],
  [50, 79, -21],
  [79, 102, -38],
  [100, 135, -62],
  [112, 172, -76],
  [120, 210, -83],
  [124, 250, -87],
  [126, 290, -90],
] as const;

const PRIMARY_POSITIONS = [
  [21, 72, -8],
  [58, 94, -28],
  [88, 132, -52],
  [108, 178, -72],
  [118, 230, -84],
] as const;

const ToothButton = memo(function ToothButton({
  toothNumber,
  arch,
  finding,
  hasHistory,
  selected,
  disabled,
  onSelect,
}: {
  toothNumber: number;
  arch: Arch;
  finding?: ToothFinding;
  hasHistory?: boolean;
  selected: boolean;
  disabled: boolean;
  onSelect: (toothNumber: number) => void;
}) {
  const position = (toothNumber >= 50 ? PRIMARY_POSITIONS : ADULT_POSITIONS)[(toothNumber % 10) - 1];
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

  return (
    <button
      type="button"
      className={styles.jawTooth}
      style={{ left: `${x / 6}%`, top: `${y / 3.6}%` }}
      onClick={() => onSelect(toothNumber)}
      disabled={disabled}
      aria-label={`Tooth ${toothNumber}: ${getToothName(toothNumber)}`}
      aria-pressed={selected}
      data-fdi={toothNumber}
      data-condition={condition}
      data-arch={arch}
      data-kind={kind}
      data-dentition={toothNumber >= 50 ? 'primary' : 'permanent'}
      data-patient-side={right ? 'right' : 'left'}
      title={`FDI ${toothNumber} — ${getToothName(toothNumber)}\n${finding ? finding.status + '; ' + finding.conditions.join(', ') : 'No finding recorded for current visit'}${hasHistory ? '\n(Has previous visit findings)' : ''}`}
    >
      <span className={styles.jawToothArt} style={{ transform: `rotate(${rotation}deg)` }}>
        <ToothShape kind={kind} />
      </span>
      <span
        className={styles.jawNumber}
        style={
          anterior
            ? { left: '50%', top: arch === 'upper' ? '-17px' : 'calc(100% + 3px)', transform: 'translateX(-50%)' }
            : { top: '50%', ...(right ? { right: 'calc(100% - 16px)' } : { left: 'calc(100% - 16px)' }), transform: 'translateY(-50%)' }
        }
      >
        {toothNumber}
      </span>
      {condition !== 'unrecorded' ? (
        <span className={styles.jawFindingMark} aria-hidden="true">
          {condition === 'missing' ? '×' : condition === 'healthy' ? '✓' : '•'}
        </span>
      ) : hasHistory ? (
        <span className={styles.jawFindingMark} style={{ color: '#2563eb', fontWeight: 800 }} title="Has previous visit findings" aria-hidden="true">
          ◷
        </span>
      ) : null}
      {(finding?.pocket_depth_mm ?? 0) > 3 && (
        <span className={styles.jawPocket}>{finding?.pocket_depth_mm} mm</span>
      )}
    </button>
  );
});

function GumArtwork({ arch }: { arch: Arch }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 600 360" className={styles.jawGums} aria-hidden="true">
      <defs>
        <radialGradient id={id} cx="50%" cy="45%" r="65%">
          <stop stopColor="#ef9c90" />
          <stop offset=".5" stopColor="#e97e72" />
          <stop offset="1" stopColor="#c6504a" />
        </radialGradient>
        {/* Realistic 3D Tongue Gradients */}
        <radialGradient id={`${id}-sublingual`} cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor="#881337" />
          <stop offset="65%" stopColor="#9f1239" />
          <stop offset="100%" stopColor="#4c0519" />
        </radialGradient>
        <radialGradient id={`${id}-tongue-base`} cx="50%" cy="55%" r="62%">
          <stop offset="0%" stopColor="#fda4af" />
          <stop offset="40%" stopColor="#f43f5e" />
          <stop offset="80%" stopColor="#e11d48" />
          <stop offset="100%" stopColor="#9f1239" />
        </radialGradient>
        <radialGradient id={`${id}-tongue-highlight`} cx="50%" cy="38%" r="48%">
          <stop offset="0%" stopColor="#ffe4e6" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#fecdd3" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fda4af" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-tongue-tip`} cx="50%" cy="75%" r="42%">
          <stop offset="0%" stopColor="#fecdd3" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#fb7185" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ── Realistic 3D Tongue in Lower Dental Arch ── */}
      {arch === 'lower' && (
        <g aria-hidden="true" transform="translate(300, 150) scale(0.88, 0.72) translate(-300, -150)">
          {/* Sublingual floor depth */}
          <path
            d="M 188 72 Q 300 120 412 72 C 416 168 385 272 300 286 C 215 272 184 168 188 72 Z"
            fill={`url(#${id}-sublingual)`}
            opacity="0.92"
          />

          {/* Tongue body (anatomical dome contour) */}
          <path
            d="M 198 86 C 195 160 216 262 300 276 C 384 262 405 160 402 86 C 360 112 240 112 198 86 Z"
            fill={`url(#${id}-tongue-base)`}
            stroke="#be123c"
            strokeWidth="1.5"
          />

          {/* Dorsal surface highlights for 3D realism */}
          <ellipse cx="300" cy="180" rx="68" ry="46" fill={`url(#${id}-tongue-highlight)`} />
          <ellipse cx="300" cy="230" rx="44" ry="24" fill={`url(#${id}-tongue-tip)`} />

          {/* Median lingual sulcus (central anatomical groove) */}
          <path
            d="M 300 110 Q 298 180 300 256"
            fill="none"
            stroke="#9f1239"
            strokeWidth="2.8"
            strokeLinecap="round"
            opacity="0.65"
          />
          <path
            d="M 301 112 Q 299 181 301 254"
            fill="none"
            stroke="#ffe4e6"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.8"
          />

          {/* Circumvallate papillae chevron texture row */}
          {[-26, -18, -10, 0, 10, 18, 26].map((dx) => (
            <circle
              key={dx}
              cx={300 + dx}
              cy={128 + Math.abs(dx) * 0.45}
              r="2.2"
              fill="#fda4af"
              stroke="#be123c"
              strokeWidth="0.6"
              opacity="0.85"
            />
          ))}
          {[-20, -12, -4, 4, 12, 20].map((dx) => (
            <circle
              key={`sub-${dx}`}
              cx={300 + dx}
              cy={136 + Math.abs(dx) * 0.4}
              r="1.6"
              fill="#fda4af"
              opacity="0.65"
            />
          ))}
        </g>
      )}

      {/* ── Gum Tissue Arch ── */}
      <g transform={arch === 'lower' ? 'translate(0 360) scale(1 -1)' : undefined}>
        <path
          d={
            arch === 'upper'
              ? 'M300 43 C215 37 165 107 150 207 L148 293 Q147 325 178 322 C226 321 242 276 300 276 C358 276 374 321 422 322 Q453 325 452 293 L450 207 C435 107 385 37 300 43Z'
              : 'M300 43 C215 37 165 107 150 207 L148 293 Q147 325 178 322 Q199 320 196 295 C191 218 220 126 273 106 Q300 95 327 106 C380 126 409 218 404 295 Q401 320 422 322 Q453 325 452 293 L450 207 C435 107 385 37 300 43Z'
          }
          fill={`url(#${id})`}
          stroke="#cb7770"
          strokeWidth="2"
        />
        <path
          d="M185 296 C179 221 203 112 265 90 Q300 76 335 90 C397 112 421 221 415 296"
          fill="none"
          stroke="#f3b4a9"
          strokeWidth="9"
          opacity=".5"
        />
        {arch === 'upper' ? (
          <>
            <path d="M212 278 C207 193 236 128 300 124 C364 128 393 193 388 278 Q346 246 300 248 Q254 246 212 278Z" fill="#dc8079" opacity=".4" />
            {[0, 1, 2, 3, 4].map((index) => (
              <path
                key={index}
                d={`M${264 - index * 7} ${143 + index * 13} Q280 ${130 + index * 13} 300 ${135 + index * 13} Q320 ${130 + index * 13} ${336 + index * 7} ${143 + index * 13}`}
                fill="none"
                stroke="#f7b2a2"
                strokeWidth="4"
                strokeLinecap="round"
                opacity=".28"
              />
            ))}
          </>
        ) : null}
      </g>

      {/* ── Anatomical Midline Vertical Guide Line ── */}
      <line
        x1="300"
        y1="25"
        x2="300"
        y2="335"
        stroke="#3b82f6"
        strokeWidth="1.2"
        strokeDasharray="4 4"
        opacity="0.32"
      />

      {/* ── Arch Centered Anatomical Label ── */}
      <text
        x="300"
        y={arch === 'upper' ? 231 : 172}
        textAnchor="middle"
        fill={arch === 'upper' ? '#8b4544' : '#ffffff'}
        fontSize={arch === 'upper' ? '12.5' : '10.5'}
        fontWeight="700"
        letterSpacing="0.04em"
        style={arch === 'lower' ? { textShadow: '0 1px 3px rgba(0,0,0,0.6)' } : undefined}
      >
        {arch === 'upper' ? 'UPPER' : 'TONGUE'}
      </text>
    </svg>
  );
}

function GroupGuide({ primary, arch }: { primary: boolean; arch: Arch }) {
  const positions = primary ? PRIMARY_POSITIONS : ADULT_POSITIONS;
  const groups = primary
    ? [
        { text: 'Canine', first: 3, last: 3 },
        { text: 'Molars', first: 4, last: 5 },
      ]
    : [
        { text: 'Canine', first: 3, last: 3 },
        { text: 'Premolars', first: 4, last: 5 },
        { text: 'Molars', first: 6, last: 8 },
      ];
  // Use the tooth artwork coordinates so brackets stay aligned in either dentition.
  const labels = groups.flatMap((group) => {
    const first = positions[group.first - 1];
    const last = positions[group.last - 1];
    if (!first || !last) return [];
    // Leave a visible break between adjacent group brackets.
    const start = first[1] - 10;
    const end = last[1] + 10;
    return [{ ...group, start: arch === 'upper' ? start : 360 - end, end: arch === 'upper' ? end : 360 - start }];
  });
  return (
    <div className={styles.jawGuides} aria-label={`${arch === 'upper' ? 'Upper' : 'Lower'} tooth groups`}>
      <svg className={styles.jawGroupBrackets} viewBox="0 0 600 360" aria-hidden="true">
        <path
          data-tooth-group="Incisors"
          d={arch === 'upper' ? 'M228 28 V16 H372 V28 M300 16 V12' : 'M228 332 V344 H372 V332 M300 344 V348'}
        />
        {labels.flatMap(({ text, start, end }) =>
          [true, false].map((right) => {
            const x = right ? 132 : 468;
            const tip = right ? x + 10 : x - 10;
            return (
              <path
                key={`${text}-${right}`}
                data-tooth-group={text}
                d={`M${tip} ${start} H${x} V${end} H${tip} M${x} ${(start + end) / 2} h${right ? -4 : 4}`}
              />
            );
          }),
        )}
      </svg>
      <span className={styles.jawIncisorGuide} style={{ top: arch === 'upper' ? '-2%' : '97%' }}>
        Incisors
      </span>
      {labels.flatMap(({ text, start, end }) =>
        [true, false].map((right) => (
          <span
            key={`${text}-${right}`}
            className={styles.jawSideGuide}
            style={{ top: `${(start + end) / 7.2}%`, ...(right ? { right: '79%' } : { left: '79%' }) }}
          >
            {text}
          </span>
        )),
      )}
    </div>
  );
}

const archTeeth = (dentition: DentitionType, arch: Arch): readonly number[] => {
  if (dentition === 'PERMANENT') {
    return arch === 'upper'
      ? [...PERMANENT_QUADRANTS.Q1_UPPER_RIGHT, ...PERMANENT_QUADRANTS.Q2_UPPER_LEFT]
      : [...PERMANENT_QUADRANTS.Q4_LOWER_RIGHT, ...PERMANENT_QUADRANTS.Q3_LOWER_LEFT];
  }
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
  patientAge = null,
  visibleArches = 'both',
  showLegend = true,
}) => {
  const [internalDentition, setInternalDentition] = useState<DentitionType>(defaultDentition);
  const [prevDefault, setPrevDefault] = useState<DentitionType>(defaultDentition);
  const [viewMode, setViewMode] = useState<ViewMode>('2d');

  // 3D scene refs and controls
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneControllerRef = useRef<OralCavity3DController | null>(null);
  const calloutRefreshFrameRef = useRef<number | null>(null);
  const pointerStateRef = useRef({ down: false, lastX: 0, lastY: 0, button: 0, moved: false });
  const [calloutOverlay, setCalloutOverlay] = useState<{
    callouts: AnatomicalCallout[];
    width: number;
    height: number;
  }>({ callouts: [], width: 0, height: 0 });

  const refresh3DCallouts = useCallback(() => {
    if (calloutRefreshFrameRef.current !== null) {
      cancelAnimationFrame(calloutRefreshFrameRef.current);
    }
    calloutRefreshFrameRef.current = requestAnimationFrame(() => {
      calloutRefreshFrameRef.current = null;
      const controller = sceneControllerRef.current;
      const canvas = canvasRef.current;
      if (!controller || !canvas) return;
      setCalloutOverlay({
        callouts: controller.getAnatomicalCallouts(),
        width: canvas.clientWidth,
        height: canvas.clientHeight,
      });
    });
  }, []);

  if (prevDefault !== defaultDentition) {
    setPrevDefault(defaultDentition);
    setInternalDentition(defaultDentition);
  }

  const dentitionView = controlledDentition ?? internalDentition;
  const primary = dentitionView === 'PRIMARY';

  const historyTeethSet = useMemo(
    () => new Set((historicalTeeth ?? []).map((t) => t.tooth_number)),
    [historicalTeeth],
  );


  // Mount / unmount 3D scene when switching viewMode
  useEffect(() => {
    if (viewMode !== '3d' || !canvasRef.current) return;
    let controller: OralCavity3DController | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let cancelled = false;
    import('./dental-3d-scene').then(({ createOralCavity3DScene }) => {
      if (cancelled || !canvasRef.current) return;
      controller = createOralCavity3DScene(canvasRef.current);
      sceneControllerRef.current = controller;
      controller.setTeethData(teeth, historicalTeeth ?? [], selectedToothNumber);
      controller.setDentition(dentitionView);
      controller.setCameraPreset('clinical');
      resizeObserver = new ResizeObserver(() => {
        controller?.resize();
        refresh3DCallouts();
      });
      resizeObserver.observe(canvasRef.current);
      refresh3DCallouts();
      setTimeout(refresh3DCallouts, 60);
      setTimeout(refresh3DCallouts, 250);
    });
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (calloutRefreshFrameRef.current !== null) {
        cancelAnimationFrame(calloutRefreshFrameRef.current);
        calloutRefreshFrameRef.current = null;
      }
      controller?.dispose();
      sceneControllerRef.current = null;
    };
  }, [viewMode]);

  // Keep 3D scene synced with data
  useEffect(() => {
    if (viewMode !== '3d') return;
    sceneControllerRef.current?.setTeethData(teeth, historicalTeeth ?? [], selectedToothNumber);
  }, [viewMode, teeth, historicalTeeth, selectedToothNumber]);

  useEffect(() => {
    if (viewMode !== '3d') return;
    sceneControllerRef.current?.setDentition(dentitionView);
  }, [viewMode, dentitionView]);

  const handlePointerDown = useCallback((_e: React.PointerEvent<HTMLCanvasElement>) => {
    // Fixed anatomical view: drag rotation disabled
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    // Show pointer cursor when hovering over an interactive tooth
    const sc = sceneControllerRef.current;
    if (sc && !disabled) {
      const hoveredTooth = sc.pickTooth(e.clientX, e.clientY);
      e.currentTarget.style.cursor = hoveredTooth ? 'pointer' : 'default';
    }
  }, [disabled]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!disabled) {
      const pickedTooth = sceneControllerRef.current?.pickTooth(e.clientX, e.clientY);
      if (pickedTooth) onSelectTooth(pickedTooth);
    }
  }, [disabled, onSelectTooth]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    // Fixed anatomical view: zoom disabled to keep teeth locked in mouth artwork
  }, []);

  const renderArch = (arch: Arch) => {
    const numbers = archTeeth(dentitionView, arch);
    const rightQuad = arch === 'upper' ? (primary ? 5 : 1) : (primary ? 8 : 4);
    const leftQuad = arch === 'upper' ? (primary ? 6 : 2) : (primary ? 7 : 3);

    const rightIssues = teeth.filter((t) => {
      const q = Math.floor(t.tooth_number / 10);
      if (q !== rightQuad) return false;
      const c = conditionFor(t);
      return c !== 'unrecorded' && c !== 'healthy';
    }).length;

    const leftIssues = teeth.filter((t) => {
      const q = Math.floor(t.tooth_number / 10);
      if (q !== leftQuad) return false;
      const c = conditionFor(t);
      return c !== 'unrecorded' && c !== 'healthy';
    }).length;

    return (
      <section
        className={styles.jawSection}
        aria-label={`${arch === 'upper' ? 'Maxillary upper' : 'Mandibular lower'} arch`}
      >
        <div className={styles.archHeaderBar}>
          <div
            className={`${styles.archPatientSideBadge} ${styles.patientSideRight}`}
            title={`Patient's Right Side (${arch === 'upper' ? (primary ? 'Q5 Upper' : 'Q1 Upper') : (primary ? 'Q8 Lower' : 'Q4 Lower')})`}
          >
            <span className={styles.sideArrow}>◀</span>
            <div className={styles.sideLabelText}>
              <strong>PATIENT RIGHT</strong>
              <span className={styles.sideSubtext}>
                Your Left · {arch === 'upper' ? (primary ? 'Q5 (Upper)' : 'Q1 (Upper)') : (primary ? 'Q8 (Lower)' : 'Q4 (Lower)')}
              </span>
            </div>
            {rightIssues > 0 ? (
              <span className={styles.sideIssuePill}>
                {rightIssues} issue{rightIssues > 1 ? 's' : ''}
              </span>
            ) : (
              <span className={styles.sideHealthyPill}>✓ Normal</span>
            )}
          </div>

          <header className={styles.jawHeader}>
            <strong>
              {arch === 'upper' ? 'Maxillary Arch' : 'Mandibular Arch'}
              <span>{arch === 'upper' ? '(Upper)' : '(Lower)'}</span>
            </strong>
          </header>

          <div
            className={`${styles.archPatientSideBadgeRight} ${styles.patientSideLeft}`}
            title={`Patient's Left Side (${arch === 'upper' ? (primary ? 'Q6 Upper' : 'Q2 Upper') : (primary ? 'Q7 Lower' : 'Q3 Lower')})`}
          >
            {leftIssues > 0 ? (
              <span className={styles.sideIssuePill}>
                {leftIssues} issue{leftIssues > 1 ? 's' : ''}
              </span>
            ) : (
              <span className={styles.sideHealthyPill}>✓ Normal</span>
            )}
            <div className={styles.sideLabelText}>
              <strong>PATIENT LEFT</strong>
              <span className={styles.sideSubtext}>
                Your Right · {arch === 'upper' ? (primary ? 'Q6 (Upper)' : 'Q2 (Upper)') : (primary ? 'Q7 (Lower)' : 'Q3 (Lower)')}
              </span>
            </div>
            <span className={styles.sideArrow}>▶</span>
          </div>
        </div>

        <div className={styles.jawOrientation}>
          <span>Patient right</span>
          <span>Patient left</span>
        </div>
        <div className={styles.jawStage}>
          <GumArtwork arch={arch} />
          <GroupGuide primary={primary} arch={arch} />
          {numbers.map((number) => (
            <ToothButton
              key={number}
              toothNumber={number}
              arch={arch}
              finding={teeth.find((item) => item.tooth_number === number)}
              hasHistory={historyTeethSet.has(number)}
              selected={selectedToothNumber === number}
              disabled={disabled}
              onSelect={onSelectTooth}
            />
          ))}
        </div>
      </section>
    );
  };

  const renderDentitionControl = () => {
    if (primary) {
      return (
        <div
          className={styles.dentitionIndicator}
          aria-label="Dentition type: Primary / Deciduous (automatically determined)"
        >
          <i className="ph ph-baby" aria-hidden="true" />
          <span>Primary / Deciduous (Pediatric — 20 Teeth)</span>
          {patientAge !== null && (
            <span
              className={styles.dentitionAutoBadge}
              title={`Automatically selected based on patient age (${patientAge} years)`}
            >
              ✓ Auto ({patientAge}y)
            </span>
          )}
        </div>
      );
    }

    return (
      <div
        className={styles.dentitionIndicator}
        aria-label="Dentition type: Permanent Dentition (automatically determined)"
      >
        <i className="ph ph-user" aria-hidden="true" />
        <span>Permanent Dentition (Adult — 32 Teeth)</span>
        {patientAge !== null && (
          <span
            className={styles.dentitionAutoBadge}
            title={`Automatically selected based on patient age (${patientAge} years)`}
          >
            ✓ Auto ({patientAge}y)
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={styles.odontogramCard}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', padding: '4px 8px 8px' }}>
        {renderDentitionControl()}
        {/* View-mode toggle */}
        {/* <div className={styles.viewToggleBar} role="group" aria-label="Chart view mode">
          <button
            type="button"
            className={`${styles.viewToggleBtn} ${viewMode === '2d' ? styles.viewToggleBtnActive : ''}`}
            onClick={() => setViewMode('2d')}
            title="2D Anatomical Chart (default)"
          >
            <i className="ph ph-image" aria-hidden="true" />
            <span>2D View</span>
          </button>
          <button
            type="button"
            className={`${styles.viewToggleBtn} ${viewMode === '3d' ? styles.viewToggleBtnActive : ''}`}
            onClick={() => setViewMode('3d')}
            title="3D Anatomical View — select a tooth to chart findings"
          >
            <i className="ph ph-cube" aria-hidden="true" />
            <span>3D View</span>
          </button>
        </div> */}
      </div>

      {/* ── 2D Anatomical Dental Chart ── */}
      {viewMode === '2d' && (
        <div className={styles.anatomicalChartViewport}>
          <div className={styles.jawChart} data-testid="anatomical-odontogram">
            <p className={styles.patientPerspective}>Dental chart orientation · patient perspective</p>
            <p className={styles.chartSelectionHint}>Select a tooth to view its findings and choose affected surfaces below the chart.</p>
            {visibleArches !== 'lower' ? renderArch('upper') : null}
            {visibleArches !== 'upper' ? renderArch('lower') : null}
          </div>
        </div>
      )}

      {/* ── 3D Interactive WebGL Scene ── */}
      {viewMode === '3d' && (
        <div className={styles.oralCavity3DStage}>
          <AnatomicalMouthBackground width={calloutOverlay.width || 800} height={calloutOverlay.height || 580} />
          <canvas
            ref={canvasRef}
            className={styles.oralCavity3DCanvas}
            aria-label="Interactive 3D dental model — select a tooth to chart findings"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
            tabIndex={0}
          />
          <AnatomicalMouthForeground width={calloutOverlay.width || 800} height={calloutOverlay.height || 580} />
          {calloutOverlay.width > 0 && calloutOverlay.height > 0 ? (
            <svg
              className={styles.anatomicalCalloutOverlay}
              viewBox={`0 0 ${calloutOverlay.width} ${calloutOverlay.height}`}
              aria-hidden="true"
            >
              {(['left', 'right'] as const).flatMap((side) => {
                const ordered = CALLOUT_ORDER[side]
                  .map((id) => calloutOverlay.callouts.find((item) => item.id === id))
                  .filter((item): item is AnatomicalCallout => Boolean(item?.visible));
                const top = 28;
                const bottom = calloutOverlay.height - 66;
                return ordered.map((item, index) => {
                  const labelY = ordered.length === 1
                    ? (top + bottom) / 2
                    : top + (index * (bottom - top)) / (ordered.length - 1);
                  const textX = side === 'left' ? 12 : calloutOverlay.width - 12;
                  const lineStartX = side === 'left' ? 112 : calloutOverlay.width - 112;
                  const elbowX = side === 'left'
                    ? Math.min(item.screenX - 14, lineStartX + 58)
                    : Math.max(item.screenX + 14, lineStartX - 58);
                  return (
                    <g key={item.id}>
                      <polyline
                        className={styles.anatomicalLeaderLine}
                        points={`${lineStartX},${labelY} ${elbowX},${labelY} ${item.screenX},${item.screenY}`}
                      />
                      <circle className={styles.anatomicalAnchorDot} cx={item.screenX} cy={item.screenY} r="2.4" />
                      <text
                        className={styles.anatomicalCalloutText}
                        dominantBaseline="middle"
                        textAnchor={side === 'left' ? 'start' : 'end'}
                        x={textX}
                        y={labelY}
                      >
                        {item.label}
                      </text>
                    </g>
                  );
                });
              })}
            </svg>
          ) : null}
          <div className={styles.oralAnatomyCaption}>
            <strong>Interactive Oral Anatomy</strong>
            <span>Select a tooth to chart findings</span>
          </div>
          {/* Accessible arch sections for DOM test compatibility */}
          <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            {visibleArches !== 'lower' ? renderArch('upper') : null}
            {visibleArches !== 'upper' ? renderArch('lower') : null}
          </div>
        </div>
      )}

      {showLegend ? (
        <div className={styles.odontogramLegend} aria-label="Clinical condition legend">
          <span><i className={styles.legendHealthy} />Healthy</span>
          <span><i className={styles.legendCaries} />Caries</span>
          <span><i className={styles.legendFilled} />Restored / Filled</span>
          <span><i className={styles.legendCrown} />Crown</span>
          <span><i className={styles.legendRoot} />Root Piece</span>
          <span><i className={styles.legendMissing}>×</i>Missing</span>
          {(historicalTeeth?.length ?? 0) > 0 && (
            <span style={{ color: '#2563eb', fontWeight: 600 }}>
              <span style={{ display: 'inline-block', marginRight: '4px', fontSize: '0.85rem' }}>◷</span>
              Prior Visit History ({historicalTeeth?.length})
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
};


