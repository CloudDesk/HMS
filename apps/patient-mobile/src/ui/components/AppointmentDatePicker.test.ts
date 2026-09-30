// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppointmentDatePicker } from './AppointmentDatePicker';
import { latestSelfRegistrationDob } from '../../auth/registration-date';
import { focusedInputScrollDelta } from '../useFocusedInputScroll';

vi.mock('react-native', () => {
  const view = ({ children }: { children?: ReactNode }) => createElement('div', null, children);
  return {
    View: view, Text: view, TouchableWithoutFeedback: view,
    Modal: ({ visible, children }: { visible: boolean; children?: ReactNode }) => visible ? view({ children }) : null,
    TouchableOpacity: ({ children, onPress, disabled, accessibilityLabel }: { children?: ReactNode; onPress: () => void; disabled?: boolean; accessibilityLabel?: string }) =>
      createElement('button', { onClick: onPress, disabled, 'aria-label': accessibilityLabel }, children),
    StyleSheet: { create: (styles: unknown) => styles },
    Platform: { OS: 'android', select: (values: Record<string, unknown>) => values.android ?? values.default },
    Keyboard: { dismiss: vi.fn() }, TextInput: {},
  };
});
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });
function button(text: string) {
  const found = [...container.querySelectorAll('button')].find((element) => element.textContent === text || element.getAttribute('aria-label') === text);
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
}
it('opens DOB calendar, prevents dates beyond the age limit and emits the API date format', async () => {
  const onChange = vi.fn();
  await act(async () => root.render(createElement(AppointmentDatePicker, {
    value: '2001-02-24', minDate: '', maxDate: '2001-02-24', showQuickOptions: false, onChange,
  })));
  expect(container.textContent).toContain('2001');
  await act(async () => container.querySelector('button')!.click());
  expect(button('25').disabled).toBe(true);
  await act(async () => button('25').click());
  expect(onChange).not.toHaveBeenCalled();
  await act(async () => button('24').click());
  expect(onChange).toHaveBeenCalledWith('2001-02-24');
  expect(container.textContent).not.toContain('Close');
});
it('supports year selection and optional document date clearing', async () => {
  const onChange = vi.fn();
  await act(async () => root.render(createElement(AppointmentDatePicker, {
    value: '2026-09-29', minDate: '', showQuickOptions: false, allowClear: true, onChange,
  })));
  await act(async () => container.querySelector('button')!.click());
  await act(async () => button('Choose year').click());
  await act(async () => button('2025').click());
  await act(async () => button('20').click());
  expect(onChange).toHaveBeenCalledWith('2025-09-20');
  await act(async () => button('Clear date').click());
  expect(onChange).toHaveBeenLastCalledWith('');
});
it('keeps appointment quick options and minimum date restriction', async () => {
  await act(async () => root.render(createElement(AppointmentDatePicker, {
    value: '2026-09-29', minDate: '2026-09-29', onChange: vi.fn(),
  })));
  expect(container.querySelectorAll('button').length).toBeGreaterThan(1);
  const opener = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes('Change Date'))!;
  await act(async () => opener.click());
  expect(button('28').disabled).toBe(true);
  expect(button('29').disabled).toBe(false);
});
it('preserves the age 15 threshold including leap-day boundaries', () => {
  expect(latestSelfRegistrationDob(new Date(2026, 8, 30))).toBe('2011-09-30');
  expect(latestSelfRegistrationDob(new Date(2024, 1, 29))).toBe('2009-02-28');
});
it('scrolls obscured fields only by the missing space and leaves visible inputs still', () => {
  expect(focusedInputScrollDelta(470, 50, 100, 500)).toBe(36);
  expect(focusedInputScrollDelta(300, 50, 100, 500)).toBe(0);
  expect(focusedInputScrollDelta(90, 50, 100, 500)).toBe(-26);
});
