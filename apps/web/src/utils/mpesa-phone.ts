/**
 * M-Pesa phone number normalization and masking utilities.
 * Enforces Kenyan Safaricom/Airtel MSISDN rules for STK Push.
 */

export type MpesaPhoneValidationResult = {
  valid: boolean;
  normalized?: string;
  error?: string;
};

/**
 * Normalizes user-entered phone number into standard Kenyan format: 254XXXXXXXXX.
 * Supported entry formats:
 * - 07XXXXXXXX / 01XXXXXXXX
 * - +2547XXXXXXXX / +2541XXXXXXXX
 * - 2547XXXXXXXX / 2541XXXXXXXX
 * (With optional spaces, hyphens, or parentheses)
 */
export function normalizeMpesaPhone(input: string): MpesaPhoneValidationResult {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'Phone number is required.' };
  }

  // Strip all whitespace, hyphens, parentheses, and dots
  let cleaned = input.replace(/[\s\-().]/g, '');

  // Strip leading '+'
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }

  // Must only contain digits now
  if (!/^\d+$/.test(cleaned)) {
    return {
      valid: false,
      error: 'Phone number must contain digits only.',
    };
  }

  // Handle local 10-digit format (07XXXXXXXX, 01XXXXXXXX)
  if (cleaned.length === 10) {
    if (cleaned.startsWith('07') || cleaned.startsWith('01')) {
      cleaned = `254${cleaned.slice(1)}`;
    } else {
      return {
        valid: false,
        error: 'Kenyan mobile numbers must start with 07 or 01 (e.g., 0712345678).',
      };
    }
  } else if (cleaned.length === 9) {
    // Missing leading zero (7XXXXXXXX or 1XXXXXXXX)
    if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      cleaned = `254${cleaned}`;
    } else {
      return {
        valid: false,
        error: 'Enter a valid 9-digit or 10-digit mobile number starting with 7 or 1.',
      };
    }
  }

  // Strict validation against Safaricom/Kenyan regex: 254[17]XXXXXXXX (12 digits)
  const mpesaRegex = /^254[17]\d{8}$/;
  if (!mpesaRegex.test(cleaned)) {
    return {
      valid: false,
      error: 'Enter a valid Kenyan mobile number (e.g. 07XXXXXXXX, 01XXXXXXXX, or 2547XXXXXXXX).',
    };
  }

  return { valid: true, normalized: cleaned };
}

/**
 * Masks a phone number for secure staff UI display.
 * Example: '254712345678' -> '254••••••5678'
 */
export function maskMpesaPhone(phone: string): string {
  if (!phone) return '••••';
  const clean = phone.replace(/[\s\-+]/g, '');
  if (clean.length < 4) return '••••';
  const last4 = clean.slice(-4);
  const prefix = clean.startsWith('254') ? '+254 ' : '';
  return `${prefix}•••• ${last4}`;
}
