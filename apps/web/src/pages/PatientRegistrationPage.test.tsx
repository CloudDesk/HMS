import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientRegistrationPage } from './PatientRegistrationPage';

vi.mock('../routing/navigation', () => ({
  navigate: vi.fn(),
}));

const mockRegisterPatient = vi.fn();
vi.mock('../hooks/patients/usePatientRegistrationFeature', () => ({
  usePatientRegistrationFeature: () => ({
    state: {
      submitting: false,
      branches: [{ id: 'branch-1', name: 'Main Clinic' }],
    },
    actions: {
      registerPatient: mockRegisterPatient,
    },
  }),
}));

function setInputValue(input: HTMLInputElement | null, value: string) {
  if (!input) return;
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setValue?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement | null, value: string) {
  if (!select) return;
  const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  setValue?.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('PatientRegistrationPage modal & form validation', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    mockRegisterPatient.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = async (embedded = true) => {
    await act(async () => {
      root.render(<PatientRegistrationPage embedded={embedded} />);
    });
  };

  it('initially disables the Save Patient button when required fields are empty', async () => {
    await render();
    const saveButton = container.querySelector<HTMLButtonElement>('button[name="saveMode"]');
    expect(saveButton).not.toBeNull();
    expect(saveButton?.disabled).toBe(true);
  });

  it('renders SVG flag for phone country code instead of raw Windows text', async () => {
    await render();
    const phoneFlag = container.querySelector('.patient-reg-flag svg');
    expect(phoneFlag).not.toBeNull();
    expect(phoneFlag?.getAttribute('viewBox')).toBe('0 0 20 14');
  });

  it('renders exactly one leading calendar icon and no stray trailing icon for Date of Birth', async () => {
    await render();
    const dobField = container.querySelector('#patient-dob')?.closest('.patient-reg-input-group');
    expect(dobField).not.toBeNull();
    // Only one leading calendar icon exists in the input group
    const calendarIcons = dobField?.querySelectorAll('.ph-calendar, .ph-calendar-blank');
    expect(calendarIcons?.length).toBe(1);
    expect(calendarIcons?.[0]?.classList.contains('ph-calendar')).toBe(true);
    // Trailing icon element is completely absent
    const trailingIcon = dobField?.querySelector('.patient-reg-trailing-icon');
    expect(trailingIcon).toBeNull();
  });

  it('enables the Save Patient button only when all required fields are valid', async () => {
    await render();
    const saveButton = container.querySelector<HTMLButtonElement>('button[name="saveMode"]');
    expect(saveButton?.disabled).toBe(true);

    const lastNameInput = container.querySelector<HTMLInputElement>('#patient-last-name');
    const genderSelect = container.querySelector<HTMLSelectElement>('#patient-gender');
    const dobInput = container.querySelector<HTMLInputElement>('#patient-dob');
    const phoneInput = container.querySelector<HTMLInputElement>('#patient-phone');

    // Fill last name
    await act(async () => {
      setInputValue(lastNameInput, 'Mensah');
    });
    expect(saveButton?.disabled).toBe(true);

    // Select gender
    await act(async () => {
      setSelectValue(genderSelect, 'MALE');
    });
    expect(saveButton?.disabled).toBe(true);

    // Enter valid date of birth (adult, so no parentGuardian required)
    await act(async () => {
      setInputValue(dobInput, '1990-05-15');
    });
    expect(saveButton?.disabled).toBe(true);

    // Enter phone
    await act(async () => {
      setInputValue(phoneInput, '24 123 4567');
    });

    // Now all required fields (lastName, gender, DOB, phone, default consent: true) are satisfied
    expect(saveButton?.disabled).toBe(false);

    // Future DOB should disable Save button
    await act(async () => {
      setInputValue(dobInput, '2099-01-01');
    });
    expect(saveButton?.disabled).toBe(true);

    // Minor (< 16 years) without parent/guardian should keep Save button disabled
    await act(async () => {
      setInputValue(dobInput, '2020-01-01');
    });
    expect(saveButton?.disabled).toBe(true);

    // Adding parent/guardian for minor enables Save button
    const guardianInput = container.querySelector<HTMLInputElement>('#patient-parent-guardian');
    await act(async () => {
      setInputValue(guardianInput, 'Akua Mensah');
    });
    expect(saveButton?.disabled).toBe(false);

    // Unchecking consent disables Save button
    const consentCheckbox = container.querySelector<HTMLInputElement>('.patient-reg-consent-label input[type="checkbox"]');
    await act(async () => {
      consentCheckbox?.click();
    });
    expect(saveButton?.disabled).toBe(true);
  });
});
