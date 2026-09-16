// @vitest-environment jsdom

import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToothFinding } from '../../../api/opd';
import { OdontogramChart } from './OdontogramChart';

const findings: ToothFinding[] = [
  { tooth_number: 31, dentition: 'PERMANENT', status: 'PRESENT', surfaces: ['BUCCAL'], conditions: ['CARIOUS'], mobility: 'NONE', pocket_depth_mm: 4, furcation_involvement: null, notes: null },
  { tooth_number: 35, dentition: 'PERMANENT', status: 'PRESENT', surfaces: ['OCCLUSAL'], conditions: ['FILLED'], mobility: 'NONE', pocket_depth_mm: null, furcation_involvement: null, notes: null },
  { tooth_number: 16, dentition: 'PERMANENT', status: 'MISSING', surfaces: [], conditions: ['MISSING'], mobility: null, pocket_depth_mm: null, furcation_involvement: null, notes: null },
];

function ControlledChart({ onSelection }: { onSelection?: (tooth: number) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  return <><OdontogramChart teeth={findings} selectedToothNumber={selected} onSelectTooth={(tooth) => { setSelected(tooth); onSelection?.(tooth); }} />
    <output aria-label="Selected tooth context">{selected ? `Tooth #${selected}` : 'General / Full Mouth'}</output></>;
}

describe('anatomical Dental odontogram', () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

  it('renders all 32 permanent FDI teeth in patient-perspective anatomical arches', async () => {
    await act(async () => root.render(<ControlledChart />));
    const controls = container.querySelectorAll<HTMLButtonElement>('[data-fdi]');
    expect(controls).toHaveLength(32);
    expect(Array.from(controls).map((item) => Number(item.dataset.fdi))).toEqual([
      18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
      48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
    ]);
    expect(container.textContent).toContain('Maxillary Arch / Upper');
    expect(container.textContent).toContain('Mandibular Arch / Lower');
    expect(container.textContent).toContain('patient perspective');
    expect(container.textContent).toContain('Premolars');
  });

  it('renders all 20 primary teeth with the same anatomical arch model', async () => {
    await act(async () => root.render(<ControlledChart />));
    const primary = Array.from(container.querySelectorAll('button')).find((item) => item.textContent?.includes('Primary / Deciduous'));
    await act(async () => primary?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const controls = container.querySelectorAll<HTMLButtonElement>('[data-fdi]');
    expect(controls).toHaveLength(20);
    expect(Array.from(controls).map((item) => Number(item.dataset.fdi))).toEqual([
      55, 54, 53, 52, 51, 61, 62, 63, 64, 65, 85, 84, 83, 82, 81, 71, 72, 73, 74, 75,
    ]);
    expect(container.textContent).not.toContain('Premolars');
  });

  it('changes the selected FDI tooth without duplicating controls or context', async () => {
    const selection = vi.fn();
    await act(async () => root.render(<ControlledChart onSelection={selection} />));
    const select = async (number: number) => act(async () => container.querySelector<HTMLButtonElement>(`[data-fdi="${number}"]`)?.click());
    await select(31);
    expect(container.querySelector('[data-fdi="31"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[aria-label="Selected tooth context"]')?.textContent).toBe('Tooth #31');
    await select(35); await select(16); await select(35);
    expect(selection.mock.calls.map(([number]) => number)).toEqual([31, 35, 16, 35]);
    expect(container.querySelectorAll('[data-fdi]')).toHaveLength(32);
    expect(container.querySelectorAll('[aria-label="Selected tooth context"]')).toHaveLength(1);
    expect(container.querySelector('[data-fdi="35"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('applies each finding to its correct tooth silhouette and exposes native keyboard controls', async () => {
    await act(async () => root.render(<ControlledChart />));
    const tooth31 = container.querySelector<HTMLButtonElement>('[data-fdi="31"]');
    const tooth35 = container.querySelector<HTMLButtonElement>('[data-fdi="35"]');
    const tooth16 = container.querySelector<HTMLButtonElement>('[data-fdi="16"]');
    expect(tooth31?.dataset.condition).toBe('caries');
    expect(tooth31?.textContent).toContain('4 mm');
    expect(tooth35?.dataset.condition).toBe('filled');
    expect(tooth16?.dataset.condition).toBe('missing');
    expect(tooth31?.tagName).toBe('BUTTON');
    expect(tooth31?.getAttribute('aria-label')).toContain('Tooth 31');
  });
});
