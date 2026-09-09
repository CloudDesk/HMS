import React from 'react';
import type { ToothSurface } from '../../../api/opd';
import { isAnteriorTooth, isUpperArch, TOOTH_SURFACES } from '../../../pages/dental-utils';
import styles from './DentalExamination.module.css';

interface ToothSurfaceSelectorProps {
  surfaces: ToothSurface[];
  onChange: (surfaces: ToothSurface[]) => void;
  disabled?: boolean;
  toothNumber?: number | null;
}

export const ToothSurfaceSelector: React.FC<ToothSurfaceSelectorProps> = ({
  surfaces,
  onChange,
  disabled = false,
  toothNumber = null,
}) => {
  const isSelected = (surface: ToothSurface) => surfaces.includes(surface);

  const isAnterior = toothNumber ? isAnteriorTooth(toothNumber) : false;
  const isUpper = toothNumber ? isUpperArch(toothNumber) : false;

  const toggleSurface = (surface: ToothSurface) => {
    if (disabled) return;
    if (isSelected(surface)) {
      onChange(surfaces.filter((s) => s !== surface));
    } else {
      onChange([...surfaces, surface]);
    }
  };

  const getFill = (surface: ToothSurface) => {
    return isSelected(surface) ? '#3b82f6' : '#f8fafc';
  };

  const getSurfaceLabel = (surface: ToothSurface): string => {
    switch (surface) {
      case 'OCCLUSAL':
        return isAnterior ? 'I — Incisal' : 'O — Occlusal';
      case 'BUCCAL':
        return isAnterior ? 'La — Labial / Facial' : 'B — Buccal';
      case 'LINGUAL':
        return isUpper ? 'P — Palatal' : 'L — Lingual';
      case 'MESIAL':
        return 'M — Mesial';
      case 'DISTAL':
        return 'D — Distal';
      default:
        return surface;
    }
  };

  return (
    <div className={styles.surfaceSelectorBox}>
      <svg
        className={styles.surfaceDiagram}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Tooth surface selector diagram"
      >
        {/* Buccal / Labial (Top) */}
        <polygon
          points="10,10 90,10 70,30 30,30"
          fill={getFill('BUCCAL')}
          stroke="#64748b"
          strokeWidth="1.5"
          style={{ cursor: disabled ? 'not-allowed' : 'pointer', transition: 'fill 0.15s ease' }}
          onClick={() => toggleSurface('BUCCAL')}
          data-testid="surface-buccal"
        >
          <title>{isAnterior ? 'Labial / Facial (La)' : 'Buccal (B)'}</title>
        </polygon>

        {/* Mesial (Left) */}
        <polygon
          points="10,10 30,30 30,70 10,90"
          fill={getFill('MESIAL')}
          stroke="#64748b"
          strokeWidth="1.5"
          style={{ cursor: disabled ? 'not-allowed' : 'pointer', transition: 'fill 0.15s ease' }}
          onClick={() => toggleSurface('MESIAL')}
          data-testid="surface-mesial"
        >
          <title>Mesial (M)</title>
        </polygon>

        {/* Distal (Right) */}
        <polygon
          points="90,10 90,90 70,70 70,30"
          fill={getFill('DISTAL')}
          stroke="#64748b"
          strokeWidth="1.5"
          style={{ cursor: disabled ? 'not-allowed' : 'pointer', transition: 'fill 0.15s ease' }}
          onClick={() => toggleSurface('DISTAL')}
          data-testid="surface-distal"
        >
          <title>Distal (D)</title>
        </polygon>

        {/* Lingual / Palatal (Bottom) */}
        <polygon
          points="30,70 70,70 90,90 10,90"
          fill={getFill('LINGUAL')}
          stroke="#64748b"
          strokeWidth="1.5"
          style={{ cursor: disabled ? 'not-allowed' : 'pointer', transition: 'fill 0.15s ease' }}
          onClick={() => toggleSurface('LINGUAL')}
          data-testid="surface-lingual"
        >
          <title>{isUpper ? 'Palatal (P)' : 'Lingual (L)'}</title>
        </polygon>

        {/* Occlusal / Incisal (Center) */}
        <polygon
          points="30,30 70,30 70,70 30,70"
          fill={getFill('OCCLUSAL')}
          stroke="#64748b"
          strokeWidth="1.5"
          style={{ cursor: disabled ? 'not-allowed' : 'pointer', transition: 'fill 0.15s ease' }}
          onClick={() => toggleSurface('OCCLUSAL')}
          data-testid="surface-occlusal"
        >
          <title>{isAnterior ? 'Incisal (I)' : 'Occlusal (O)'}</title>
        </polygon>

        {/* Labels inside diagram */}
        <text x="50" y="22" textAnchor="middle" fontSize="9" fontWeight="bold" fill={isSelected('BUCCAL') ? '#fff' : '#64748b'} pointerEvents="none">
          {isAnterior ? 'La' : 'B'}
        </text>
        <text x="21" y="53" textAnchor="middle" fontSize="9" fontWeight="bold" fill={isSelected('MESIAL') ? '#fff' : '#64748b'} pointerEvents="none">
          M
        </text>
        <text x="79" y="53" textAnchor="middle" fontSize="9" fontWeight="bold" fill={isSelected('DISTAL') ? '#fff' : '#64748b'} pointerEvents="none">
          D
        </text>
        <text x="50" y="84" textAnchor="middle" fontSize="9" fontWeight="bold" fill={isSelected('LINGUAL') ? '#fff' : '#64748b'} pointerEvents="none">
          {isUpper ? 'P' : 'L'}
        </text>
        <text x="50" y="53" textAnchor="middle" fontSize="9" fontWeight="bold" fill={isSelected('OCCLUSAL') ? '#fff' : '#64748b'} pointerEvents="none">
          {isAnterior ? 'I' : 'O'}
        </text>
      </svg>

      <div className={styles.surfaceButtonsRow}>
        {TOOTH_SURFACES.map((surf: (typeof TOOTH_SURFACES)[number]) => {
          const active = isSelected(surf.value);
          return (
            <button
              key={surf.value}
              type="button"
              disabled={disabled}
              className={`${styles.surfaceBtn} ${active ? styles.surfaceBtnActive : ''}`}
              onClick={() => toggleSurface(surf.value)}
              title={`${getSurfaceLabel(surf.value)}: ${surf.desc}`}
            >
              {getSurfaceLabel(surf.value)}
            </button>
          );
        })}
      </div>
    </div>
  );
};
