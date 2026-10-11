// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  system: 'light' as 'light' | 'dark',
  override: 'unspecified' as 'light' | 'dark' | 'unspecified',
  snapshot: 'light' as 'light' | 'dark',
  stored: '' as string,
  failWrite: false,
  appearanceListeners: new Set<() => void>(),
  stateListeners: new Set<(state: string) => void>(),
  statusBar: {} as { barStyle?: string; backgroundColor?: string },
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Appearance: {
    getColorScheme: () => native.snapshot,
    // RN updates its snapshot without necessarily emitting an appearance event.
    setColorScheme: (value: typeof native.override) => {
      native.override = value;
      native.snapshot = value === 'unspecified' ? native.system : value;
    },
    addChangeListener: (listener: () => void) => {
      native.appearanceListeners.add(listener);
      return { remove: () => native.appearanceListeners.delete(listener) };
    },
  },
  AppState: {
    addEventListener: (_event: string, listener: (state: string) => void) => {
      native.stateListeners.add(listener);
      return { remove: () => native.stateListeners.delete(listener) };
    },
  },
  StatusBar: (props: typeof native.statusBar) => { native.statusBar = props; return null; },
}));

vi.mock('expo-file-system', () => ({
  Paths: { document: 'documents' },
  File: class {
    get exists() { return native.stored !== ''; }
    textSync() { return native.stored; }
    write(value: string) {
      if (native.failWrite) throw new Error('Storage unavailable');
      native.stored = value;
    }
  },
}));

import { AppearanceProvider, AppearanceStatusBar, useAppearance, useThemedStyles } from './appearance';
import type { Theme } from './theme';

const createStyles = ({ colors, shadows }: Theme) => ({
  background: colors.neutral.background,
  text: colors.text.primary,
  modal: colors.neutral.surface,
  shadow: shadows.modal.shadowColor,
});

let root: Root;
let result: ReturnType<typeof useAppearance>;
let styles: ReturnType<typeof createStyles>;
let mounts = 0;
function Consumer() {
  result = useAppearance();
  styles = useThemedStyles(createStyles);
  useState(() => { mounts++; return 'existing form state'; });
  return createElement(AppearanceStatusBar);
}
const render = async () => {
  await act(async () => root.render(createElement(AppearanceProvider, null, createElement(Consumer))));
};
const select = async (preference: 'light' | 'dark' | 'system') => {
  await act(async () => result.setPreference(preference));
};
const changeSystem = async (scheme: 'light' | 'dark', emit = true) => {
  await act(async () => {
    native.system = scheme;
    if (emit) {
      native.snapshot = native.override === 'unspecified' ? native.system : native.override;
      native.appearanceListeners.forEach(listener => listener());
    }
  });
};

describe('live appearance provider', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    native.system = 'light';
    native.override = 'unspecified';
    native.snapshot = 'light';
    native.stored = '';
    native.failWrite = false;
    mounts = 0;
    root = createRoot(document.createElement('div'));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    expect(native.appearanceListeners.size).toBe(0);
    expect(native.stateListeners.size).toBe(0);
    vi.unstubAllGlobals();
  });

  it('switches dark and light immediately and repeatedly without remounting consumers', async () => {
    await render();
    for (const preference of ['dark', 'light', 'dark', 'light'] as const) {
      await select(preference);
      expect(result.preference).toBe(preference);
      expect(result.resolvedAppearance).toBe(preference);
      expect(styles.background).toBe(preference === 'dark' ? '#0B1220' : '#F8FAFC');
      expect(styles.modal).toBe(preference === 'dark' ? '#111827' : '#FFFFFF');
      expect(styles.text).toBe(preference === 'dark' ? '#F8FAFC' : '#0F172A');
      expect(native.statusBar).toMatchObject({
        barStyle: preference === 'dark' ? 'light-content' : 'dark-content',
        backgroundColor: styles.background,
      });
      expect(typeof native.statusBar.backgroundColor).toBe('string');
    }
    expect(mounts).toBe(1);
  });

  it('resolves System immediately after an explicit override and follows active system changes', async () => {
    await render();
    await select('dark');
    await select('system');
    expect(result.resolvedAppearance).toBe('light');
    await changeSystem('dark');
    expect(result.preference).toBe('system');
    expect(result.resolvedAppearance).toBe('dark');
    expect(styles.background).toBe('#0B1220');
    expect(native.statusBar.barStyle).toBe('light-content');
    await select('light');
    await select('system');
    expect(result.resolvedAppearance).toBe('dark');
    await changeSystem('light');
    expect(result.resolvedAppearance).toBe('light');
    expect(mounts).toBe(1);
  });

  it('refreshes System on resume and keeps explicit selections independent of system changes', async () => {
    await render();
    await changeSystem('dark', false);
    await act(async () => native.stateListeners.forEach(listener => listener('active')));
    expect(result.resolvedAppearance).toBe('dark');
    await select('light');
    await changeSystem('dark');
    expect(result.resolvedAppearance).toBe('light');
    expect(styles.background).toBe('#F8FAFC');
  });

  it.each(['light', 'dark', 'system'] as const)('restores %s on the first render after restart', async (preference) => {
    await render();
    await select(preference);
    expect(JSON.parse(native.stored)).toEqual({ preference });
    await act(async () => root.unmount());
    native.system = 'dark';
    root = createRoot(document.createElement('div'));
    await render();
    expect(result.preference).toBe(preference);
    expect(result.resolvedAppearance).toBe(preference === 'light' ? 'light' : 'dark');
  });

  it('keeps the active selection reactive if persistence fails', async () => {
    await render();
    native.failWrite = true;
    await select('dark');
    expect(styles.background).toBe('#0B1220');
    expect(result.preference).toBe('dark');
  });

  it('falls back to the system for corrupt saved settings', async () => {
    native.stored = '{invalid';
    native.system = 'dark';
    await render();
    expect(result.preference).toBe('system');
    expect(styles.background).toBe('#0B1220');
  });
});
