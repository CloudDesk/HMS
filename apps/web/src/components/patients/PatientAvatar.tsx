import React, { useEffect, useState } from 'react';
import { AuthenticatedMediaImage } from '../ui/AuthenticatedMediaImage';
import { patientInitials as getInitials } from '../../pages/opd-utils';

export type PatientAvatarSize = 'table' | 'sm' | 'md' | 'lg' | 'hero' | 'card' | number;

export type PatientAvatarProps = {
  patientId?: string;
  fullName?: string;
  photoUrl?: string | null;
  size?: PatientAvatarSize;
  className?: string;
  style?: React.CSSProperties;
  rounded?: 'circle' | 'square' | 'rounded';
};

type AvatarPreset = {
  width: number;
  height: number;
  borderRadius: string;
  fontSize: string;
  fontWeight: number;
};

const defaultPreset: AvatarPreset = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  fontSize: '0.72rem',
  fontWeight: 700,
};

const sizeStyles: Record<string, AvatarPreset> = {
  table: { width: 32, height: 32, borderRadius: '50%', fontSize: '0.72rem', fontWeight: 700 },
  sm: { width: 32, height: 32, borderRadius: '50%', fontSize: '0.72rem', fontWeight: 700 },
  md: { width: 40, height: 40, borderRadius: '50%', fontSize: '0.9rem', fontWeight: 700 },
  lg: { width: 48, height: 48, borderRadius: '50%', fontSize: '1.1rem', fontWeight: 700 },
  hero: { width: 64, height: 64, borderRadius: '12px', fontSize: '1.5rem', fontWeight: 700 },
  card: { width: 64, height: 64, borderRadius: '50%', fontSize: '22px', fontWeight: 800 },
};

function getPreset(size: PatientAvatarSize, rounded?: 'circle' | 'square' | 'rounded'): AvatarPreset {
  if (typeof size === 'number') {
    return {
      width: size,
      height: size,
      borderRadius: rounded === 'circle' ? '50%' : rounded === 'square' ? '0px' : '8px',
      fontSize: `${Math.round(size * 0.4)}px`,
      fontWeight: 700,
    };
  }
  return sizeStyles[size] ?? defaultPreset;
}

export function PatientAvatar({
  fullName = '',
  photoUrl,
  size = 'table',
  className = '',
  style = {},
  rounded,
}: PatientAvatarProps) {
  const [loadError, setLoadError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setLoadError(false);
    setIsLoaded(false);
  }, [photoUrl]);

  const initials = fullName ? getInitials(fullName) : '--';
  const preset = getPreset(size, rounded);
  const finalBorderRadius = rounded === 'circle' ? '50%' : rounded === 'square' ? '0px' : preset.borderRadius;

  const isHero = size === 'hero';
  const isCard = size === 'card';

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: `${preset.width}px`,
    height: `${preset.height}px`,
    minWidth: `${preset.width}px`,
    minHeight: `${preset.height}px`,
    borderRadius: finalBorderRadius,
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    background: isHero
      ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
      : isCard
        ? 'rgba(255, 255, 255, 0.2)'
        : '#eff6ff',
    color: isHero || isCard ? '#ffffff' : '#2563eb',
    fontSize: preset.fontSize,
    fontWeight: preset.fontWeight,
    border: isCard ? '3px solid rgba(255, 255, 255, 0.5)' : undefined,
    userSelect: 'none',
    ...style,
  };

  const showPhoto = Boolean(photoUrl && !loadError);

  return (
    <div className={`patient-avatar-wrap ${className}`.trim()} style={containerStyle}>
      {(!showPhoto || !isLoaded) && <span>{initials}</span>}
      {showPhoto && (
        <AuthenticatedMediaImage
          alt={fullName || 'Patient photo'}
          src={photoUrl}
          onError={() => setLoadError(true)}
          onLoad={() => setIsLoaded(true)}
          style={{
            position: isLoaded ? 'relative' : 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 'inherit',
            display: isLoaded ? 'block' : 'none',
          }}
        />
      )}
    </div>
  );
}
