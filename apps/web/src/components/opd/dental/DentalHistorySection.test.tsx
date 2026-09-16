import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DentalHistory } from '../../../api/opd';
import { DentalHistorySection } from './DentalHistorySection';

describe('DentalHistorySection component', () => {
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

  it('renders ONLY approved predefined dental & oral habits and omits removed ones', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(<DentalHistorySection history={null} onChange={onChange} />);
    });

    const text = container.textContent ?? '';

    // Approved habits present
    expect(text).toContain('Smoking / Tobacco');
    expect(text).toContain('Betel Nut / Tobacco Chewing');
    expect(text).toContain('Alcohol Consumption');
    expect(text).toContain('Bruxism / Teeth Clenching');
    expect(text).toContain('Mouth Breathing');

    // Removed habits absent
    expect(text).not.toContain('Nail Biting');
    expect(text).not.toContain('Thumb Sucking');
    expect(text).not.toContain('Tongue Thrusting');
  });

  it('renders medical alerts organized into 3 clinical categories with split conditions', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(<DentalHistorySection history={null} onChange={onChange} />);
    });

    const text = container.textContent ?? '';

    // Categories present
    expect(text).toContain('Medical Conditions');
    expect(text).toContain('Bleeding / Medication Risks');
    expect(text).toContain('Allergies');

    // Medical Conditions items
    expect(text).toContain('Hypertension');
    expect(text).toContain('Diabetes Mellitus');
    expect(text).toContain('Asthma / Respiratory Disease');
    expect(text).toContain('Heart Disease');
    expect(text).toContain('Cardiac Pacemaker');
    expect(text).toContain('Epilepsy / Seizure Disorder');
    expect(text).toContain('Hepatitis / Liver Disease');
    expect(text).toContain('Pregnancy / Nursing');

    // Bleeding / Medication Risks items
    expect(text).toContain('Bleeding Disorder');
    expect(text).toContain('Anticoagulant Therapy');
    expect(text).toContain('Steroid / Immunosuppressant Therapy');
    expect(text).toContain('Bisphosphonate Therapy (Osteonecrosis Risk)');
    expect(text).toContain('Infective Endocarditis Risk / Premedication Required');

    // Allergies items
    expect(text).toContain('Allergy to Penicillin');
    expect(text).toContain('Allergy to Local Anesthetics');
    expect(text).toContain('Allergy to Latex');

    // Combined legacy items must NOT be present as predefined options
    expect(text).not.toContain('Bleeding Disorder / Anticoagulant Therapy');
    expect(text).not.toContain('Cardiac Pacemaker / Heart Disease');
  });

  it('toggles predefined habit and calls onChange with updated array', async () => {
    const onChange = vi.fn();
    const history: DentalHistory = {
      chief_complaint: '',
      pain_scale: 0,
      bleeding_gums: false,
      sensitivity_hot_cold_sweet: false,
      bruxism: false,
      habits: [],
      medical_alerts: [],
    };

    await act(async () => {
      root.render(<DentalHistorySection history={history} onChange={onChange} />);
    });

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    const smokingBtn = buttons.find((b) => b.textContent?.includes('Smoking / Tobacco'));
    expect(smokingBtn).toBeDefined();

    await act(async () => {
      smokingBtn?.click();
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        habits: ['Smoking / Tobacco'],
      }),
    );
  });

  it('toggles predefined medical alert and calls onChange with updated array', async () => {
    const onChange = vi.fn();
    const history: DentalHistory = {
      chief_complaint: '',
      pain_scale: 0,
      bleeding_gums: false,
      sensitivity_hot_cold_sweet: false,
      bruxism: false,
      habits: [],
      medical_alerts: [],
    };

    await act(async () => {
      root.render(<DentalHistorySection history={history} onChange={onChange} />);
    });

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    const hypertensionBtn = buttons.find((b) => b.textContent?.includes('Hypertension'));
    expect(hypertensionBtn).toBeDefined();

    await act(async () => {
      hypertensionBtn?.click();
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        medical_alerts: ['Hypertension'],
      }),
    );
  });

  it('preserves and displays existing legacy saved habits (backward compatibility)', async () => {
    const onChange = vi.fn();
    // Patient has previously saved legacy habit 'Nail Biting'
    const historyWithLegacyHabit: DentalHistory = {
      chief_complaint: 'Tooth pain',
      pain_scale: 3,
      bleeding_gums: false,
      sensitivity_hot_cold_sweet: false,
      bruxism: false,
      habits: ['Nail Biting', 'Smoking / Tobacco'],
      medical_alerts: [],
    };

    await act(async () => {
      root.render(<DentalHistorySection history={historyWithLegacyHabit} onChange={onChange} />);
    });

    const text = container.textContent ?? '';
    // Nail Biting is displayed because it exists in the saved patient record
    expect(text).toContain('Nail Biting');

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    const nailBitingBtn = buttons.find((b) => b.textContent?.includes('Nail Biting'));
    expect(nailBitingBtn).toBeDefined();

    // Clicking it removes the legacy habit
    await act(async () => {
      nailBitingBtn?.click();
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        habits: ['Smoking / Tobacco'],
      }),
    );
  });

  it('preserves and displays existing legacy saved medical alerts (backward compatibility)', async () => {
    const onChange = vi.fn();
    // Patient has previously saved combined alert
    const historyWithLegacyAlert: DentalHistory = {
      chief_complaint: 'Routine Checkup',
      pain_scale: 0,
      bleeding_gums: false,
      sensitivity_hot_cold_sweet: false,
      bruxism: false,
      habits: [],
      medical_alerts: ['Bleeding Disorder / Anticoagulant Therapy'],
    };

    await act(async () => {
      root.render(<DentalHistorySection history={historyWithLegacyAlert} onChange={onChange} />);
    });

    const text = container.textContent ?? '';
    // Displayed in active alert banner and in Other / Custom Alerts group
    expect(text).toContain('Bleeding Disorder / Anticoagulant Therapy');
    expect(text).toContain('Other / Custom Alerts');

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    const legacyAlertBtn = buttons.find((b) =>
      b.textContent?.includes('Bleeding Disorder / Anticoagulant Therapy'),
    );
    expect(legacyAlertBtn).toBeDefined();

    // Clicking it allows removing the legacy alert
    await act(async () => {
      legacyAlertBtn?.click();
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        medical_alerts: [],
      }),
    );
  });

  it('supports adding custom oral habit', async () => {
    const onChange = vi.fn();
    const history: DentalHistory = {
      chief_complaint: '',
      pain_scale: 0,
      bleeding_gums: false,
      sensitivity_hot_cold_sweet: false,
      bruxism: false,
      habits: ['Smoking / Tobacco'],
      medical_alerts: [],
    };

    await act(async () => {
      root.render(<DentalHistorySection history={history} onChange={onChange} />);
    });

    const habitInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="Add other oral habit..."]',
    );
    expect(habitInput).toBeDefined();

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    const addHabitBtn = buttons.find((b) => b.textContent?.trim() === 'Add');
    expect(addHabitBtn).toBeDefined();

    await act(async () => {
      if (habitInput) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set;
        nativeInputValueSetter?.call(habitInput, 'Chewing Ice');
        habitInput.dispatchEvent(new Event('input', { bubbles: true }));
        habitInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await act(async () => {
      addHabitBtn?.click();
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        habits: ['Smoking / Tobacco', 'Chewing Ice'],
      }),
    );
  });

  it('supports adding custom medical alert/allergy', async () => {
    const onChange = vi.fn();
    const history: DentalHistory = {
      chief_complaint: '',
      pain_scale: 0,
      bleeding_gums: false,
      sensitivity_hot_cold_sweet: false,
      bruxism: false,
      habits: [],
      medical_alerts: ['Hypertension'],
    };

    await act(async () => {
      root.render(<DentalHistorySection history={history} onChange={onChange} />);
    });

    const alertInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="Add other medical alert/allergy..."]',
    );
    expect(alertInput).toBeDefined();

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    const addAlertBtn = buttons.find((b) => b.textContent?.trim() === 'Add Alert');
    expect(addAlertBtn).toBeDefined();

    await act(async () => {
      if (alertInput) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set;
        nativeInputValueSetter?.call(alertInput, 'Allergy to Sulfa');
        alertInput.dispatchEvent(new Event('input', { bubbles: true }));
        alertInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await act(async () => {
      addAlertBtn?.click();
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        medical_alerts: ['Hypertension', 'Allergy to Sulfa'],
      }),
    );
  });

  it('disables interactions when disabled prop is true', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(<DentalHistorySection history={null} onChange={onChange} disabled={true} />);
    });

    for (const button of container.querySelectorAll<HTMLButtonElement>('button')) {
      expect(button.disabled).toBe(true);
      button.click();
    }

    expect(onChange).not.toHaveBeenCalled();

    // Inputs should not be rendered when disabled
    const habitInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="Add other oral habit..."]',
    );
    expect(habitInput).toBeNull();

    const alertInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="Add other medical alert/allergy..."]',
    );
    expect(alertInput).toBeNull();
  });
});
