import type { ChangeEvent } from 'react';

export type VitalStatusTone = 'normal' | 'warning' | 'alert' | 'info' | 'neutral';

export type ClinicalVitalCardProps = {
  id: string;
  label: string;
  unit: string;
  icon: string;
  themeColor: 'red' | 'rose' | 'amber' | 'sky' | 'teal' | 'indigo' | 'violet';
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  step?: number;
  min?: number;
  max?: number;
  normalRange: string;
  statusLabel?: string;
  statusTone?: VitalStatusTone;
  disabled?: boolean;
  required?: boolean;
};

export function ClinicalVitalCard({
  id,
  label,
  unit,
  icon,
  themeColor,
  value,
  onChange,
  placeholder,
  step = 1,
  min,
  max,
  normalRange,
  statusLabel,
  statusTone = 'neutral',
  disabled = false,
  required = false,
}: ClinicalVitalCardProps) {
  const handleStep = (direction: 'inc' | 'dec') => {
    if (disabled) return;
    const isDecimal = step < 1;
    const currentNum = value !== '' ? parseFloat(value) : (placeholder ? parseFloat(placeholder) : 0);
    const delta = direction === 'inc' ? step : -step;
    let nextNum = isDecimal ? parseFloat((currentNum + delta).toFixed(1)) : Math.round(currentNum + delta);
    if (min !== undefined && nextNum < min) nextNum = min;
    if (max !== undefined && nextNum > max) nextNum = max;
    onChange(String(nextNum));
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={`clinical-vital-card theme-${themeColor}`}>
      <div className="clinical-vital-card-header">
        <div className="clinical-vital-title-group">
          <div className={`clinical-vital-icon-badge ${themeColor}`}>
            <i className={`ph ${icon}`} aria-hidden="true" />
          </div>
          <div className="clinical-vital-labels">
            <span className="clinical-vital-name">{label}</span>
            <span className="clinical-vital-range">Normal: {normalRange}</span>
          </div>
        </div>
        {statusLabel ? (
          <span className={`clinical-vital-status-tag ${statusTone}`}>
            {statusLabel}
          </span>
        ) : null}
      </div>

      <div className="clinical-vital-input-row">
        <div className="clinical-vital-stepper">
          <button
            aria-label={`Decrease ${label}`}
            className="clinical-vital-btn dec"
            disabled={disabled}
            onClick={() => handleStep('dec')}
            tabIndex={-1}
            type="button"
          >
            <i className="ph ph-minus" aria-hidden="true" />
          </button>
          <input
            className="clinical-vital-field-value"
            disabled={disabled}
            id={id}
            max={max}
            min={min}
            onChange={handleInputChange}
            onWheel={(e) => (e.target as HTMLInputElement).blur()}
            placeholder={placeholder}
            required={required}
            step={step}
            type="number"
            value={value}
          />
          <button
            aria-label={`Increase ${label}`}
            className="clinical-vital-btn inc"
            disabled={disabled}
            onClick={() => handleStep('inc')}
            tabIndex={-1}
            type="button"
          >
            <i className="ph ph-plus" aria-hidden="true" />
          </button>
        </div>
        <span className="clinical-vital-unit-badge">{unit}</span>
      </div>
    </div>
  );
}

// ── Diagnostic Helpers ─────────────────────────────────────────────────────────

export function evaluateSystolicBp(val: string): { label: string; tone: VitalStatusTone } | null {
  if (!val) return null;
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  if (n < 90) return { label: 'Low BP', tone: 'warning' };
  if (n <= 120) return { label: 'Normal', tone: 'normal' };
  if (n <= 129) return { label: 'Elevated', tone: 'warning' };
  if (n <= 139) return { label: 'Stage 1 HTN', tone: 'warning' };
  return { label: 'Stage 2 HTN', tone: 'alert' };
}

export function evaluateDiastolicBp(val: string): { label: string; tone: VitalStatusTone } | null {
  if (!val) return null;
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  if (n < 60) return { label: 'Low', tone: 'warning' };
  if (n <= 80) return { label: 'Normal', tone: 'normal' };
  if (n <= 89) return { label: 'Pre-HTN', tone: 'warning' };
  return { label: 'High', tone: 'alert' };
}

export function evaluatePulse(val: string): { label: string; tone: VitalStatusTone } | null {
  if (!val) return null;
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  if (n < 60) return { label: 'Bradycardia', tone: 'warning' };
  if (n <= 100) return { label: 'Normal', tone: 'normal' };
  return { label: 'Tachycardia', tone: 'alert' };
}

export function evaluateTemperature(val: string): { label: string; tone: VitalStatusTone } | null {
  if (!val) return null;
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  if (n < 36.0) return { label: 'Low Temp', tone: 'warning' };
  if (n <= 37.5) return { label: 'Normal', tone: 'normal' };
  if (n <= 38.3) return { label: 'Low Fever', tone: 'warning' };
  return { label: 'High Fever', tone: 'alert' };
}

export function evaluateSpo2(val: string): { label: string; tone: VitalStatusTone } | null {
  if (!val) return null;
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  if (n >= 95) return { label: 'Optimal', tone: 'normal' };
  if (n >= 90) return { label: 'Mild Hypoxia', tone: 'warning' };
  return { label: 'Low Alert', tone: 'alert' };
}

export function evaluateRespiratoryRate(val: string): { label: string; tone: VitalStatusTone } | null {
  if (!val) return null;
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  if (n < 12) return { label: 'Bradypnea', tone: 'warning' };
  if (n <= 20) return { label: 'Normal', tone: 'normal' };
  return { label: 'Tachypnea', tone: 'alert' };
}

export function calculateBmi(weightKg: string, heightCm: string): { bmi: number; category: string; tone: VitalStatusTone } | null {
  const w = parseFloat(weightKg);
  const h = parseFloat(heightCm);
  if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return null;
  const heightM = h / 100;
  const bmi = parseFloat((w / (heightM * heightM)).toFixed(1));
  if (bmi < 18.5) return { bmi, category: 'Underweight', tone: 'warning' };
  if (bmi <= 24.9) return { bmi, category: 'Normal Weight', tone: 'normal' };
  if (bmi <= 29.9) return { bmi, category: 'Overweight', tone: 'warning' };
  return { bmi, category: 'Obesity Class', tone: 'alert' };
}

export function calculateMap(sys: string, dia: string): number | null {
  const s = parseFloat(sys);
  const d = parseFloat(dia);
  if (isNaN(s) || isNaN(d) || s <= 0 || d <= 0) return null;
  return Math.round((2 * d + s) / 3);
}
