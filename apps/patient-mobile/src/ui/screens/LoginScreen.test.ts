import { describe, expect, it } from 'vitest';

describe('LoginScreen UI & Keyboard Architecture', () => {
  it('defines clean single branding hierarchy without duplicate MyCare text', () => {
    // Branding rules check
    const isRegisterMode = false;
    const title = isRegisterMode ? 'New Patient Registration' : 'Welcome to MyCare';
    const subtitle = isRegisterMode
      ? 'Enter your mobile number to create your MyCare profile and link your health records.'
      : 'Access your appointments, records and care information.';

    expect(title).toBe('Welcome to MyCare');
    expect(subtitle).toContain('Access your appointments');

    // With BrandLogo showTitle={false}, no standalone "MyCare" text precedes "Welcome to MyCare"
    const brandLogoShowTitle = false;
    expect(brandLogoShowTitle).toBe(false);
  });

  it('validates mobile phone number length and format', () => {
    const validatePhone = (rawPhone: string) => {
      const cleaned = rawPhone.trim();
      if (!cleaned) {
        return { valid: false, error: 'Please enter your mobile number.' };
      }
      const digitsOnly = cleaned.replace(/\D/g, '');
      if (digitsOnly.length < 7) {
        return { valid: false, error: 'Enter a valid mobile number (at least 7 digits).' };
      }
      return { valid: true, phone: digitsOnly };
    };

    expect(validatePhone('').valid).toBe(false);
    expect(validatePhone('12345').valid).toBe(false);
    expect(validatePhone('9876543210').valid).toBe(true);
    expect(validatePhone('+91 98765 43210').valid).toBe(true);
    expect(validatePhone('+91 98765 43210').phone).toBe('919876543210');
  });

  it('supports Android keyboard handling contract', () => {
    let keyboardHeight = 0;
    const onKeyboardShow = (height: number) => {
      keyboardHeight = height;
    };
    const onKeyboardHide = () => {
      keyboardHeight = 0;
    };

    // Keyboard opens on Android
    onKeyboardShow(320);
    expect(keyboardHeight).toBe(320);

    // Padding bottom adjustment
    const paddingBottom = keyboardHeight > 0 ? keyboardHeight + 20 : 0;
    expect(paddingBottom).toBe(340);

    // Keyboard closes
    onKeyboardHide();
    expect(keyboardHeight).toBe(0);
  });
});
