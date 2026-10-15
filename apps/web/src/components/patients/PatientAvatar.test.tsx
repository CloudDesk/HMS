import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientAvatar } from './PatientAvatar';

// Mock AuthenticatedMediaImage
vi.mock('../ui/AuthenticatedMediaImage', () => ({
  AuthenticatedMediaImage: ({ src, alt, onError, ...props }: any) => {
    return (
      <img
        src={src}
        alt={alt}
        data-testid="auth-image"
        onError={onError}
        {...props}
      />
    );
  },
}));

describe('PatientAvatar', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders initials when no photoUrl is provided', () => {
    act(() => {
      root.render(<PatientAvatar fullName="Mark P" photoUrl={null} size="table" />);
    });

    expect(container.textContent).toContain('MP');
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders AuthenticatedMediaImage when photoUrl is provided', () => {
    act(() => {
      root.render(
        <PatientAvatar
          fullName="Mark P"
          photoUrl="/api/patients/patient-1/photo"
          size="hero"
        />,
      );
    });

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/api/patients/patient-1/photo');
    expect(img?.getAttribute('alt')).toBe('Mark P');
  });

  it('falls back to initials when image errors', () => {
    act(() => {
      root.render(
        <PatientAvatar
          fullName="Mark P"
          photoUrl="/api/patients/patient-1/photo"
          size="hero"
        />,
      );
    });

    const img = container.querySelector('img');
    expect(img).not.toBeNull();

    // Trigger error
    act(() => {
      img?.dispatchEvent(new Event('error'));
    });

    expect(container.textContent).toContain('MP');
    expect(container.querySelector('img')).toBeNull();
  });
});
