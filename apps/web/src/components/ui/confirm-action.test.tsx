import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmAction } from './confirm-action';

async function open() {
  let result!: Promise<boolean>;
  await act(async () => { result = confirmAction('Remove this diagnosis from the draft?'); });
  return { result };
}

async function click(label: string) {
  const button = [...document.querySelectorAll('button')].find((item) => item.textContent === label);
  expect(button).toBeDefined();
  await act(async () => button?.click());
}

afterEach(async () => {
  await act(async () => window.dispatchEvent(new Event('pagehide')));
  vi.restoreAllMocks();
});

describe('HMS action confirmation', () => {
  it('uses the shared dialog and resolves only after confirmation', async () => {
    const native = vi.spyOn(window, 'confirm');
    const { result } = await open();
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Remove this diagnosis');
    await click('Confirm');
    expect(await result).toBe(true);
    expect(native).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('keeps the action cancelled on Cancel or Escape', async () => {
    const first = await open();
    await click('Cancel');
    expect(await first.result).toBe(false);
    const second = await open();
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(await second.result).toBe(false);
  });

  it('declines duplicate requests without opening a second dialog', async () => {
    const { result } = await open();
    expect(await confirmAction('Duplicate action')).toBe(false);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    await click('Cancel');
    expect(await result).toBe(false);
  });

  it('cancels a pending action when the encounter route changes', async () => {
    const { result } = await open();
    await act(async () => window.dispatchEvent(new Event('hms:navigation')));
    expect(await result).toBe(false);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
