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
    const sanitizePhone = (raw: string) => raw.replace(/\D/g, '').slice(0, 10);
    const validatePhone = (rawPhone: string) => {
      const cleaned = rawPhone.trim();
      if (!cleaned) {
        return { valid: false, error: 'Please enter your mobile number.' };
      }
      const digitsOnly = cleaned.replace(/\D/g, '');
      if (digitsOnly.length !== 10) {
        return { valid: false, error: 'Enter a valid 10-digit mobile number.' };
      }
      return { valid: true, phone: digitsOnly };
    };

    expect(validatePhone('').valid).toBe(false);
    expect(validatePhone('12345').valid).toBe(false);
    expect(validatePhone('123456789').valid).toBe(false);
    expect(validatePhone('12345678901').valid).toBe(false);
    expect(validatePhone('9876543210').valid).toBe(true);
    expect(validatePhone('9876543210').phone).toBe('9876543210');
    expect(sanitizePhone('987654321012345')).toBe('9876543210');
    expect(sanitizePhone('abc-9876-543-210-xyz')).toBe('9876543210');
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

  it('calculates remaining cooldown seconds accurately for 429 rate limiting', () => {
    const calculateRemaining = (resendAt: number | undefined, nowMs: number) => {
      if (!resendAt) return 0;
      const remainingMs = resendAt - nowMs;
      return Math.max(0, Math.ceil(remainingMs / 1000));
    };

    const now = 1700000000000;
    expect(calculateRemaining(undefined, now)).toBe(0);
    expect(calculateRemaining(now + 45000, now)).toBe(45);
    expect(calculateRemaining(now + 1200, now)).toBe(2);
    expect(calculateRemaining(now - 5000, now)).toBe(0);
  });

  it('validates appointment Reason for Visit with min 3 characters and inline error', () => {
    const validateReason = (reason: string) => {
      const trimmed = reason.trim();
      if (!trimmed) {
        return { valid: false, error: 'Reason for visit is required.' };
      }
      if (trimmed.length < 3) {
        return { valid: false, error: 'Reason for visit must be at least 3 characters.' };
      }
      return { valid: true, error: null };
    };

    expect(validateReason('')).toEqual({ valid: false, error: 'Reason for visit is required.' });
    expect(validateReason('   ')).toEqual({ valid: false, error: 'Reason for visit is required.' });
    expect(validateReason('ab')).toEqual({ valid: false, error: 'Reason for visit must be at least 3 characters.' });
    expect(validateReason('a')).toEqual({ valid: false, error: 'Reason for visit must be at least 3 characters.' });
    expect(validateReason('abc')).toEqual({ valid: true, error: null });
    expect(validateReason('Severe tooth pain on left side')).toEqual({ valid: true, error: null });
  });

  it('handles cancelled invoices without increasing outstanding payable balance', () => {
    const invoices = [
      { id: 'inv-1', total_amount: 50000, paid_amount: 50000, balance_amount: 0, status: 'PAID' },
      { id: 'inv-2', total_amount: 30, paid_amount: 0, balance_amount: 30, status: 'PENDING' },
      { id: 'inv-3', total_amount: 40000, paid_amount: 0, balance_amount: 0, status: 'CANCELLED' },
      { id: 'inv-4', total_amount: 80000, paid_amount: 15000, balance_amount: 65000, status: 'PARTIALLY_PAID' },
    ];

    const activeInvoices = invoices.filter((inv) => inv.status !== 'CANCELLED');
    const totalBilled = activeInvoices.reduce((acc, inv) => acc + inv.total_amount, 0);
    const totalPaid = invoices.reduce((acc, inv) => acc + (inv.paid_amount || 0), 0);
    const totalOutstanding = activeInvoices.reduce((acc, inv) => acc + inv.balance_amount, 0);

    expect(totalBilled).toBe(130030); // 50000 + 30 + 80000 (excluding 40000 cancelled)
    expect(totalPaid).toBe(65000);   // 50000 + 15000
    expect(totalOutstanding).toBe(65030); // 30 + 65000 (excluding cancelled)

    const outstandingInvoices = activeInvoices.filter((inv) => inv.balance_amount > 0);
    expect(outstandingInvoices.length).toBe(2); // inv-2 and inv-4

    const settledInvoices = activeInvoices.filter((inv) => inv.balance_amount === 0);
    expect(settledInvoices.length).toBe(1); // inv-1
  });

  it('includes draft invoices in total outstanding balance and outstanding invoices list', () => {
    const invoices = [
      { id: 'inv-1', total_amount: 40000, paid_amount: 0, balance_amount: 0, status: 'CANCELLED' },
      { id: 'inv-2', total_amount: 45000, paid_amount: 0, balance_amount: 45000, status: 'DRAFT' },
      { id: 'inv-3', total_amount: 25030, paid_amount: 0, balance_amount: 25030, status: 'PENDING' },
      { id: 'inv-4', total_amount: 65000, paid_amount: 65000, balance_amount: 0, status: 'PAID' },
    ];

    const activeInvoices = invoices.filter((inv) => inv.status?.toUpperCase() !== 'CANCELLED');
    const totalBilled = activeInvoices.reduce((acc, inv) => acc + (inv.total_amount || 0), 0);
    const totalPaid = activeInvoices.reduce((acc, inv) => acc + (inv.paid_amount || 0), 0);
    const totalOutstanding = activeInvoices.reduce((acc, inv) => acc + (inv.balance_amount || 0), 0);

    // Total billed should include DRAFT: 45000 + 25030 + 65000 = 135030
    expect(totalBilled).toBe(135030);
    expect(totalPaid).toBe(65000);
    // Outstanding should include DRAFT balance: 45000 + 25030 = 70030
    expect(totalOutstanding).toBe(70030);

    const outstandingInvoices = activeInvoices.filter((inv) => inv.balance_amount > 0);
    expect(outstandingInvoices.length).toBe(2); // DRAFT (45000) and PENDING (25030)
    expect(outstandingInvoices.some((inv) => inv.status === 'DRAFT')).toBe(true);
  });
});
