import type { ChangeEvent } from 'react';

type VitalStepperInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  required?: boolean;
};

export function VitalStepperInput({
  id,
  value,
  onChange,
  placeholder,
  step = 1,
  min,
  max,
  disabled = false,
  required = false,
}: VitalStepperInputProps) {
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
    <div className="vital-stepper-container">
      <button
        aria-label="Decrease value"
        className="vital-stepper-btn dec"
        disabled={disabled}
        onClick={() => handleStep('dec')}
        tabIndex={-1}
        type="button"
      >
        <i className="ph ph-minus" aria-hidden="true" />
      </button>
      <input
        className="vital-stepper-input"
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
        aria-label="Increase value"
        className="vital-stepper-btn inc"
        disabled={disabled}
        onClick={() => handleStep('inc')}
        tabIndex={-1}
        type="button"
      >
        <i className="ph ph-plus" aria-hidden="true" />
      </button>
    </div>
  );
}
