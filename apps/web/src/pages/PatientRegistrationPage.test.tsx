import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientRegistrationPage } from './PatientRegistrationPage';

const testState = vi.hoisted(() => ({
  registerPatient: vi.fn(),
  submitting: false,
  branches: [{ id: 'branch-1', name: 'Main Branch' }],
}));

vi.mock('../hooks/patients/usePatientRegistrationFeature', () => ({
  usePatientRegistrationFeature: () => ({
    state: {
      branches: testState.branches,
      submitting: testState.submitting,
    },
    actions: {
      registerPatient: testState.registerPatient,
    },
  }),
}));

vi.mock('../routing/navigation', () => ({
  navigate: vi.fn(),
  useAppLocation: () => ({ pathname: '/patients/register', search: '' }),
}));

describe('PatientRegistrationPage phone validation', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    testState.registerPatient.mockReset();
    testState.registerPatient.mockResolvedValue({ id: 'pat-1', patient_number: 'HMS-2026-000100' });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const renderComponent = async () => {
    await act(async () => {
      root.render(<PatientRegistrationPage />);
    });
  };

  const setInputValue = (input: HTMLInputElement, value: string) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    nativeInputValueSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const fillBaseValidForm = () => {
    const lastNameInput = container.querySelector('#patient-last-name') as HTMLInputElement;
    const dobInput = container.querySelector('#patient-dob') as HTMLInputElement;
    const consentCheckbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;

    act(() => {
      if (lastNameInput) {
        setInputValue(lastNameInput, 'Sharma');
      }
      if (dobInput) {
        setInputValue(dobInput, '1990-01-01');
      }
      if (consentCheckbox) {
        consentCheckbox.click();
      }
    });
  };

  const setPhoneAndSubmit = async (phoneValue: string) => {
    const phoneInput = container.querySelector('#patient-phone') as HTMLInputElement;
    act(() => {
      if (phoneInput) {
        setInputValue(phoneInput, phoneValue);
      }
    });

    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  };

  it('rejects empty phone number with "Phone number is required"', async () => {
    await renderComponent();
    fillBaseValidForm();
    await setPhoneAndSubmit('');

    expect(container.textContent).toContain('Phone number is required');
    expect(testState.registerPatient).not.toHaveBeenCalled();
  });

  it('rejects invalid or malformed phone with the international guidance message', async () => {
    await renderComponent();
    fillBaseValidForm();
    await setPhoneAndSubmit('+9198765abcde');

    expect(container.textContent).toContain('Please enter a valid phone number (e.g. +91 98765 43210 or 9876543210)');
    expect(testState.registerPatient).not.toHaveBeenCalled();
  });

  it('accepts valid Indian +91 phone number and submits successfully', async () => {
    await renderComponent();
    fillBaseValidForm();
    await setPhoneAndSubmit('+919876543210');

    expect(container.textContent).not.toContain('Please enter a valid phone number');
    expect(testState.registerPatient).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '+919876543210',
        last_name: 'Sharma',
      }),
    );
  });

  it('accepts valid international +254 phone number and submits successfully', async () => {
    await renderComponent();
    fillBaseValidForm();
    await setPhoneAndSubmit('+254700100200');

    expect(container.textContent).not.toContain('Please enter a valid phone number');
    expect(testState.registerPatient).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '+254700100200',
      }),
    );
  });

  it('accepts valid domestic 10-digit phone number and submits successfully', async () => {
    await renderComponent();
    fillBaseValidForm();
    await setPhoneAndSubmit('9876543210');

    expect(container.textContent).not.toContain('Please enter a valid phone number');
    expect(testState.registerPatient).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '9876543210',
      }),
    );
  });
});
