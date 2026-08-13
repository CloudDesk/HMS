import type { ReactNode } from 'react';

type SettingsFieldProps = {
  label: string;
  error?: string;
  fullWidth?: boolean;
  children: ReactNode;
};

export function SettingsField({ label, error, fullWidth = false, children }: SettingsFieldProps) {
  return (
    <label className={`ss-field${fullWidth ? ' ss-field--full' : ''}`}>
      <span>{label}</span>
      {children}
      {error ? <small className="ss-field-error">{error}</small> : null}
    </label>
  );
}

type SettingsToggleProps = {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
};

export function SettingsToggle({ checked, description, disabled, label, onChange }: SettingsToggleProps) {
  return (
    <div className="ss-toggle-item">
      <div className="ss-toggle-info">
        <span>{label}</span>
        <small>{description}</small>
      </div>
      <label className="ss-switch">
        <input
          aria-label={label}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span className="ss-slider" />
      </label>
    </div>
  );
}
