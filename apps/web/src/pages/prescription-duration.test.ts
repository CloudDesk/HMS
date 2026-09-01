import { describe, expect, test } from 'vitest';

export function resolveMedicationDuration(selectedDropdownValue: string, customInputValue: string): string {
  const predefinedOptions = ['3 Days', '5 Days', '7 Days', '10 Days', '14 Days', '30 Days', 'Ongoing'];
  if (selectedDropdownValue === 'Custom') {
    return customInputValue.trim();
  }
  if (predefinedOptions.includes(selectedDropdownValue)) {
    return selectedDropdownValue;
  }
  return selectedDropdownValue.trim();
}

describe('Prescription Builder Custom Duration Handling', () => {
  test('Selecting 3 Days returns predefined "3 Days"', () => {
    expect(resolveMedicationDuration('3 Days', '')).toBe('3 Days');
  });

  test('Selecting Ongoing / Chronic returns predefined "Ongoing"', () => {
    expect(resolveMedicationDuration('Ongoing', '')).toBe('Ongoing');
  });

  test('Selecting Custom requires non-empty custom input', () => {
    expect(resolveMedicationDuration('Custom', '')).toBe('');
    expect(resolveMedicationDuration('Custom', '   ')).toBe('');
  });

  test('Selecting Custom correctly saves custom duration "21 Days"', () => {
    expect(resolveMedicationDuration('Custom', '21 Days')).toBe('21 Days');
  });

  test('Selecting Custom correctly saves custom duration "6 Weeks"', () => {
    expect(resolveMedicationDuration('Custom', '6 Weeks')).toBe('6 Weeks');
  });

  test('Selecting Custom correctly saves custom duration "2 Months"', () => {
    expect(resolveMedicationDuration('Custom', '2 Months')).toBe('2 Months');
  });

  test('Selecting Custom correctly saves textual duration "Until review"', () => {
    expect(resolveMedicationDuration('Custom', 'Until review')).toBe('Until review');
  });

  test('Selecting Custom correctly saves textual duration "As directed"', () => {
    expect(resolveMedicationDuration('Custom', 'As directed')).toBe('As directed');
  });

  test('Existing custom duration from database renders as Custom without losing value', () => {
    const dbDuration = '45 Days';
    const isPredefined = ['3 Days', '5 Days', '7 Days', '10 Days', '14 Days', '30 Days', 'Ongoing'].includes(dbDuration);
    expect(isPredefined).toBe(false);
    expect(resolveMedicationDuration('Custom', dbDuration)).toBe('45 Days');
  });
});
