import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToothSurfaceSelector } from './ToothSurfaceSelector';

describe('ToothSurfaceSelector clinical contract', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  it('preserves enum values and existing selections when adding and removing surfaces', async () => {
    const change = vi.fn();
    await act(async () => root.render(<ToothSurfaceSelector toothNumber={11} surfaces={['MESIAL']} onChange={change}/>));
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="surface-occlusal"]')?.click());
    expect(change).toHaveBeenLastCalledWith(['MESIAL', 'OCCLUSAL']);
    await act(async () => root.render(<ToothSurfaceSelector toothNumber={11} surfaces={['MESIAL', 'OCCLUSAL']} onChange={change}/>));
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="surface-mesial"]')?.click());
    expect(change).toHaveBeenLastCalledWith(['OCCLUSAL']);
  });
  it('keeps recorded selections visible and prevents changes while disabled', async () => {
    const change = vi.fn();
    await act(async () => root.render(<ToothSurfaceSelector toothNumber={36} surfaces={['LINGUAL']} onChange={change} disabled/>));
    for (const button of container.querySelectorAll<HTMLButtonElement>('button')) {
      expect(button.disabled).toBe(true);
      button.click();
    }
    expect(change).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="surface-lingual"]')?.getAttribute('aria-pressed')).toBe('true');
  });
  it('preserves arch labels and presents primary posterior teeth as molars', async () => {
    const change = vi.fn();
    await act(async () => root.render(<ToothSurfaceSelector toothNumber={54} surfaces={[]} onChange={change}/>));
    expect(container.textContent).toContain('Molar');
    expect(container.querySelector('[data-testid="surface-lingual"]')?.getAttribute('aria-label')).toBe('P — Palatal');
    await act(async () => root.render(<ToothSurfaceSelector toothNumber={31} surfaces={[]} onChange={change}/>));
    expect(container.querySelector('[data-testid="surface-occlusal"]')?.getAttribute('aria-label')).toBe('I — Incisal');
    expect(container.querySelector('[data-testid="surface-buccal"]')?.getAttribute('aria-label')).toBe('La — Labial / Facial');
    expect(container.querySelector('[data-testid="surface-lingual"]')?.getAttribute('aria-label')).toBe('L — Lingual');
    expect(change).not.toHaveBeenCalled();
  });
});
