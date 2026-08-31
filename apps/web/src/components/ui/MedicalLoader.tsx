import React from 'react';

export type MedicalLoaderProps = {
  text?: string;
  subtext?: string;
  size?: 'small' | 'medium' | 'large';
  compact?: boolean;
  inline?: boolean;
  className?: string;
};

export function MedicalSpinner({ size = 'sm', color }: { size?: 'xs' | 'sm' | 'md'; color?: string }) {
  const pixelSize = size === 'xs' ? '14px' : size === 'md' ? '20px' : '16px';
  return (
    <span
      className="medical-button-spinner"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: pixelSize,
        height: pixelSize,
        marginRight: '6px',
        verticalAlign: 'middle',
        color: color || 'currentColor',
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        style={{
          width: '100%',
          height: '100%',
          animation: 'medicalSpinPulse 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        }}
      >
        <path
          d="M3 12h4l2.5-6 4 12 3-8 2.5 4H21"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function MedicalLoaderOverlay({
  text = 'Processing request...',
  subtext = 'Please wait while the operation completes',
}: {
  text?: string;
  subtext?: string;
}) {
  return (
    <div className="medical-loader-overlay">
      <div className="medical-loader-overlay-card">
        <MedicalLoader size="small" text={text} subtext={subtext} />
      </div>
    </div>
  );
}

export function MedicalLoader({
  text = 'Loading medical records...',
  subtext = 'Synchronizing live hospital data',
  size = 'medium',
  compact = false,
  inline = false,
  className = '',
}: MedicalLoaderProps) {
  if (inline) {
    return (
      <span className={`medical-loader-inline ${className}`}>
        <MedicalSpinner size="sm" />
        <span>{text}</span>
      </span>
    );
  }

  if (compact) {
    return (
      <div className={`medical-loader-compact ${className}`}>
        <div className="medical-loader-pulse-dot" />
        <svg className="medical-loader-mini-ecg" viewBox="0 0 50 16" fill="none">
          <path
            d="M2 8h8l3-6 4 12 4-9 3 5 3-2h23"
            stroke="#2563eb"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="medical-loader-compact-text">{text}</span>
      </div>
    );
  }

  const iconSizes = {
    small: '36px',
    medium: '52px',
    large: '68px',
  };

  return (
    <div className={`medical-loader-wrap size-${size} ${className}`}>
      <div className="medical-loader-graphic" style={{ width: iconSizes[size], height: iconSizes[size] }}>
        <div className="medical-loader-glow-ring" />
        <div className="medical-loader-center-badge">
          <i className="ph ph-heartbeat" />
        </div>
      </div>

      <div className="medical-loader-ecg-line-wrap">
        <svg className="medical-loader-ecg-svg" viewBox="0 0 160 32" fill="none">
          <path
            d="M0 16h30l6-12 8 24 8-18 6 10 6-4h96"
            className="medical-ecg-path-bg"
            stroke="#e2e8f0"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M0 16h30l6-12 8 24 8-18 6 10 6-4h96"
            className="medical-ecg-path-pulse"
            stroke="url(#ecgGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient id="ecgGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="1" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="1" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="medical-loader-info">
        <h4 className="medical-loader-title">
          {text}
          <span className="medical-loader-dots">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </h4>
        {subtext ? <p className="medical-loader-subtitle">{subtext}</p> : null}
      </div>
    </div>
  );
}
