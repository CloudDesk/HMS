import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToothFinding } from '../../../api/opd';
import { ToothExaminationPanel } from './ToothExaminationPanel';

describe('ToothExaminationPanel refactored component', () => {
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

  it('renders prompt when no tooth is selected', async () => {
    await act(async () => {
      root.render(
        <ToothExaminationPanel
          selectedToothNumber={null}
          currentFinding={undefined}
          onUpdateFinding={vi.fn()}
          onRemoveFinding={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Select a Tooth');
  });

  it('does not render redundant Mark Healthy or Caries shortcut buttons', async () => {
    const onUpdate = vi.fn();
    await act(async () => {
      root.render(
        <ToothExaminationPanel
          selectedToothNumber={12}
          currentFinding={undefined}
          onUpdateFinding={onUpdate}
          onRemoveFinding={vi.fn()}
        />,
      );
    });

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    const buttonTexts = buttons.map((b) => b.textContent?.trim());

    // Quick action buttons must NOT be present
    expect(buttonTexts).not.toContain('Mark Healthy');
    expect(buttonTexts).not.toContain('Caries');
    expect(buttonTexts).toContain('Missing');
  });

  it('removes the Tooth Status dropdown and provides Missing under conditions', async () => {
    await act(async () => {
      root.render(
        <ToothExaminationPanel
          selectedToothNumber={12}
          currentFinding={undefined}
          onUpdateFinding={vi.fn()}
          onRemoveFinding={vi.fn()}
        />,
      );
    });

    expect(container.textContent).not.toContain('Tooth Status');
    expect(container.querySelector('select')).toBeNull();
    const missing = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === 'Missing');
    expect(missing?.getAttribute('aria-pressed')).toBe('false');
  });

  it('renders Conditions & Findings with the 9 clinical findings and Missing', async () => {
    await act(async () => {
      root.render(
        <ToothExaminationPanel
          selectedToothNumber={12}
          currentFinding={undefined}
          onUpdateFinding={vi.fn()}
          onRemoveFinding={vi.fn()}
        />,
      );
    });

    const conditionChips = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[class*="conditionChip"]'),
    ).map((b) => b.textContent?.trim());

    expect(conditionChips).toEqual([
      'Healthy',
      'Caries / Decay',
      'Filled / Restored',
      'Crown / Cap',
      'Root Piece',
      'Impacted',
      'Fractured',
      'Pulpitis / RCT Needed',
      'Periapical Lesion',
      'Missing',
    ]);
  });

  it('toggles condition finding: adding an abnormality removes Healthy; selecting Healthy clears abnormalities', async () => {
    const onUpdate = vi.fn();
    const initialFinding: ToothFinding = {
      tooth_number: 12,
      dentition: 'PERMANENT',
      status: 'PRESENT',
      surfaces: [],
      conditions: ['HEALTHY'],
      mobility: 'NONE',
      pocket_depth_mm: null,
      furcation_involvement: null,
      notes: null,
    };

    await act(async () => {
      root.render(
        <ToothExaminationPanel
          selectedToothNumber={12}
          currentFinding={initialFinding}
          onUpdateFinding={onUpdate}
          onRemoveFinding={vi.fn()}
        />,
      );
    });

    // Click 'Caries / Decay'
    const cariesBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Caries / Decay'),
    );
    expect(cariesBtn).toBeDefined();

    await act(async () => {
      cariesBtn?.click();
    });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        conditions: ['CARIOUS'],
      }),
    );

    // Now test selecting Healthy clears other conditions
    const findingWithCaries: ToothFinding = {
      ...initialFinding,
      conditions: ['CARIOUS'],
    };

    await act(async () => {
      root.render(
        <ToothExaminationPanel
          selectedToothNumber={12}
          currentFinding={findingWithCaries}
          onUpdateFinding={onUpdate}
          onRemoveFinding={vi.fn()}
        />,
      );
    });

    const healthyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Healthy',
    );
    expect(healthyBtn).toBeDefined();

    await act(async () => {
      healthyBtn?.click();
    });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        conditions: ['HEALTHY'],
      }),
    );
  });

  it('changes Tooth Status to Missing: clears surfaces and disables condition chips', async () => {
    const onUpdate = vi.fn();
    const findingWithSurfaces: ToothFinding = {
      tooth_number: 16,
      dentition: 'PERMANENT',
      status: 'PRESENT',
      surfaces: ['OCCLUSAL', 'MESIAL'],
      conditions: ['CARIOUS'],
      mobility: 'GRADE_I',
      pocket_depth_mm: 4,
      furcation_involvement: 'Class I (Incipient / Early)',
      notes: 'Deep decay',
    };

    await act(async () => {
      root.render(
        <ToothExaminationPanel
          selectedToothNumber={16}
          currentFinding={findingWithSurfaces}
          onUpdateFinding={onUpdate}
          onRemoveFinding={vi.fn()}
        />,
      );
    });

    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === 'Missing')?.click();
    });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'MISSING',
        surfaces: [],
        mobility: null,
        pocket_depth_mm: null,
        furcation_involvement: null,
      }),
    );

    // When status is MISSING, another condition remains available so it can
    // restore the tooth as present in one click.
    const missingFinding: ToothFinding = {
      ...findingWithSurfaces,
      status: 'MISSING',
      surfaces: [],
      mobility: null,
      pocket_depth_mm: null,
      furcation_involvement: null,
    };

    await act(async () => {
      root.render(
        <ToothExaminationPanel
          selectedToothNumber={16}
          currentFinding={missingFinding}
          onUpdateFinding={onUpdate}
          onRemoveFinding={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Tooth is marked as Missing');

    const conditionButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[class*="conditionChip"]'),
    );
    for (const btn of conditionButtons) {
      expect(btn.disabled).toBe(false);
    }

    await act(async () => {
      conditionButtons.find((button) => button.textContent?.trim() === 'Caries / Decay')?.click();
    });

    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'PRESENT',
        conditions: ['CARIOUS'],
        mobility: 'NONE',
      }),
    );
  });

  it('changes Tooth Status back to Present: restores conditions to Healthy', async () => {
    const onUpdate = vi.fn();
    const missingFinding: ToothFinding = {
      tooth_number: 16,
      dentition: 'PERMANENT',
      status: 'MISSING',
      surfaces: [],
      conditions: [],
      mobility: null,
      pocket_depth_mm: null,
      furcation_involvement: null,
      notes: null,
    };

    await act(async () => {
      root.render(
        <ToothExaminationPanel
          selectedToothNumber={16}
          currentFinding={missingFinding}
          onUpdateFinding={onUpdate}
          onRemoveFinding={vi.fn()}
        />,
      );
    });

    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === 'Missing')?.click();
    });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'PRESENT',
        conditions: ['HEALTHY'],
        mobility: 'NONE',
      }),
    );
  });

  it('safely handles legacy data containing conditions: ["MISSING"] without crashing', async () => {
    const legacyFinding: ToothFinding = {
      tooth_number: 16,
      dentition: 'PERMANENT',
      status: 'MISSING',
      surfaces: [],
      conditions: ['MISSING'],
      mobility: null,
      pocket_depth_mm: null,
      furcation_involvement: null,
      notes: 'Extracted long ago',
    };

    await act(async () => {
      root.render(
        <ToothExaminationPanel
          selectedToothNumber={16}
          currentFinding={legacyFinding}
          onUpdateFinding={vi.fn()}
          onRemoveFinding={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('FDI #16');
    // The unified Missing chip represents the legacy missing status.
    const conditionChips = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[class*="conditionChip"]'),
    ).map((b) => b.textContent?.trim());
    expect(conditionChips).toContain('Missing');
    const missing = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === 'Missing');
    expect(missing?.getAttribute('aria-pressed')).toBe('true');
  });

  it('represents legacy EXTRACTED status through the unified Missing condition without error', async () => {
    const legacyStatusFinding: ToothFinding = {
      tooth_number: 28,
      dentition: 'PERMANENT',
      status: 'EXTRACTED',
      surfaces: [],
      conditions: [],
      mobility: null,
      pocket_depth_mm: null,
      furcation_involvement: null,
      notes: null,
    };

    await act(async () => {
      root.render(
        <ToothExaminationPanel
          selectedToothNumber={28}
          currentFinding={legacyStatusFinding}
          onUpdateFinding={vi.fn()}
          onRemoveFinding={vi.fn()}
        />,
      );
    });

    expect(container.querySelector('select')).toBeNull();
    const missing = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === 'Missing');
    expect(missing?.getAttribute('aria-pressed')).toBe('true');
  });

  it('calls onRemoveFinding when Reset button is clicked', async () => {
    const onRemove = vi.fn();
    await act(async () => {
      root.render(
        <ToothExaminationPanel
          selectedToothNumber={12}
          currentFinding={undefined}
          onUpdateFinding={vi.fn()}
          onRemoveFinding={onRemove}
        />,
      );
    });

    const resetBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reset'),
    );
    expect(resetBtn).toBeDefined();

    await act(async () => {
      resetBtn?.click();
    });

    expect(onRemove).toHaveBeenCalledWith(12);
  });

  it('uses compact detail tabs without losing periodontal or notes controls', async () => {
    await act(async () => {
      root.render(
        <ToothExaminationPanel
          selectedToothNumber={12}
          currentFinding={undefined}
          onUpdateFinding={vi.fn()}
          onRemoveFinding={vi.fn()}
        />,
      );
    });

    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Surfaces', 'Periodontal']);
    expect(container.textContent).not.toContain('Probing Depth (mm)');

    await act(async () => tabs[1]?.click());
    expect(container.textContent).toContain('Probing Depth (mm)');
    expect(container.textContent).toContain('Furcation Involvement');

    expect(container.textContent).toContain('Tooth Notes');
  });

  it('renders Affected Surfaces section with 3D tooth context and surface buttons inside the panel', async () => {
    const onUpdate = vi.fn();
    const tooth11Finding: ToothFinding = {
      tooth_number: 11,
      dentition: 'PERMANENT',
      status: 'PRESENT',
      surfaces: [],
      conditions: ['HEALTHY'],
      mobility: 'NONE',
      pocket_depth_mm: null,
      furcation_involvement: null,
      notes: null,
    };

    await act(async () => {
      root.render(
        <ToothExaminationPanel
          selectedToothNumber={11}
          currentFinding={tooth11Finding}
          onUpdateFinding={onUpdate}
          onRemoveFinding={vi.fn()}
        />,
      );
    });

    // Verify header and Affected Surfaces section
    expect(container.textContent).toContain('FDI #11');
    expect(container.textContent).toContain('Maxillary Right Central Incisor');
    expect(container.textContent).toContain('Affected Surfaces');
    expect(container.textContent).toContain('0 / 5 selected');

    // Surface buttons exist
    const surfaceButtons = Array.from(container.querySelectorAll('button[data-testid^="surface-"]'));
    expect(surfaceButtons.length).toBe(5);

    // Click 'Mesial' surface button
    const mesialBtn = container.querySelector('button[data-testid="surface-mesial"]') as HTMLButtonElement;
    expect(mesialBtn).toBeDefined();
    await act(async () => {
      mesialBtn.click();
    });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        surfaces: ['MESIAL'],
      }),
    );
  });

  it('immediately updates 3D tooth context and surface state when switching teeth without state leakage', async () => {
    const onUpdate = vi.fn();
    const tooth11Finding: ToothFinding = {
      tooth_number: 11,
      dentition: 'PERMANENT',
      status: 'PRESENT',
      surfaces: ['MESIAL', 'OCCLUSAL'],
      conditions: ['CARIOUS'],
      mobility: 'NONE',
      pocket_depth_mm: 2,
      furcation_involvement: null,
      notes: 'Incisal wear',
    };

    await act(async () => {
      root.render(
        <ToothExaminationPanel
          selectedToothNumber={11}
          currentFinding={tooth11Finding}
          onUpdateFinding={onUpdate}
          onRemoveFinding={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('FDI #11');
    expect(container.textContent).toContain('Maxillary Right Central Incisor');
    expect(container.textContent).toContain('2 / 5 selected');

    // Switch to Tooth 21 with empty surfaces
    const tooth21Finding: ToothFinding = {
      tooth_number: 21,
      dentition: 'PERMANENT',
      status: 'PRESENT',
      surfaces: [],
      conditions: ['HEALTHY'],
      mobility: 'NONE',
      pocket_depth_mm: null,
      furcation_involvement: null,
      notes: null,
    };

    await act(async () => {
      root.render(
        <ToothExaminationPanel
          selectedToothNumber={21}
          currentFinding={tooth21Finding}
          onUpdateFinding={onUpdate}
          onRemoveFinding={vi.fn()}
        />,
      );
    });

    // Must immediately update to Tooth 21 and show 0/5 without retaining Tooth 11 surfaces
    expect(container.textContent).toContain('FDI #21');
    expect(container.textContent).toContain('Maxillary Left Central Incisor');
    expect(container.textContent).toContain('0 / 5 selected');
    expect(container.textContent).not.toContain('2 / 5 selected');
  });

  it('hides Affected Surfaces and 3D viewer when tooth status is MISSING', async () => {
    const missingFinding: ToothFinding = {
      tooth_number: 11,
      dentition: 'PERMANENT',
      status: 'MISSING',
      surfaces: [],
      conditions: [],
      mobility: null,
      pocket_depth_mm: null,
      furcation_involvement: null,
      notes: null,
    };

    await act(async () => {
      root.render(
        <ToothExaminationPanel
          selectedToothNumber={11}
          currentFinding={missingFinding}
          onUpdateFinding={vi.fn()}
          onRemoveFinding={vi.fn()}
        />,
      );
    });

    // Should NOT render Affected Surfaces section or 3D viewer
    expect(container.querySelector('section[aria-label="Affected Surfaces"]')).toBeNull();
    expect(container.textContent).not.toContain('/ 5 selected');
  });

  it('does not duplicate tooth number or name inside the Affected Surfaces section header', async () => {
    await act(async () => {
      root.render(
        <ToothExaminationPanel
          selectedToothNumber={11}
          currentFinding={undefined}
          onUpdateFinding={vi.fn()}
          onRemoveFinding={vi.fn()}
        />,
      );
    });

    // Main panel header contains FDI #11 and tooth name
    const mainHeader = container.querySelector('div[class*="panelHeader"]');
    expect(mainHeader?.textContent).toContain('FDI #11');
    expect(mainHeader?.textContent).toContain('Maxillary Right Central Incisor');

    // Affected Surfaces section must NOT repeat "FDI #11 • Maxillary Right Central Incisor"
    const affectedSection = container.querySelector('section[aria-label="Affected Surfaces"]');
    expect(affectedSection).not.toBeNull();
    const affectedHeader = affectedSection?.querySelector('h3');
    expect(affectedHeader?.textContent).toBe('Affected Surfaces');
    expect(affectedSection?.querySelector('span[class*="affectedSurfacesToothContext"]')).toBeNull();
  });
});
