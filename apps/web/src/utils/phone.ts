/**
 * Validates whether a phone number represents a structurally valid
 * international (E.164-compatible) or standard national telephone number.
 *
 * Rules:
 * - Allowed characters: digits, optional leading '+', and standard separators (spaces, hyphens, parentheses, dots).
 * - Exactly one '+' allowed, strictly at index 0.
 * - Parentheses, if present, must be properly matched and balanced without nesting.
 * - Alphabetic characters and invalid symbols are rejected.
 * - Digit length constraints:
 *   - Overall digits: between 7 and 15 digits (ITU-T E.164 maximum is 15).
 *   - International format (starts with '+'):
 *     - Country calling code: 1 to 3 digits (1-999, never starts with 0).
 *     - Subscriber number: at least 4 digits, total digits between 8 and 15.
 *     - Indian numbers (+91): exactly 10-digit subscriber number (12 digits total), national subscriber cannot start with 0.
 *     - Subscriber number cannot be all zeroes.
 *   - National format (without '+'):
 *     - Optional national trunk prefix '0' (cannot start with '00').
 *     - Total digits: 7 to 14 digits.
 *     - Cannot consist entirely of zeroes.
 */
export function isValidPhoneNumber(phone: unknown): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const trimmed = phone.trim();
  if (!trimmed) return false;

  // Only digits, whitespace, hyphens, parentheses, dots, and at most one leading '+'
  if (!/^\+?[0-9\s().-]+$/.test(trimmed)) return false;

  // Validate balanced parentheses
  const openParens = (trimmed.match(/\(/g) || []).length;
  const closeParens = (trimmed.match(/\)/g) || []).length;
  if (openParens !== closeParens || openParens > 1) return false;
  if (openParens === 1) {
    const openIdx = trimmed.indexOf('(');
    const closeIdx = trimmed.indexOf(')');
    if (openIdx > closeIdx) return false;
    const inside = trimmed.slice(openIdx + 1, closeIdx);
    if (!/^\d+$/.test(inside)) return false;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return false;

  // Reject all zeroes
  if (/^0+$/.test(digits)) return false;

  const isInternational = trimmed.startsWith('+');

  if (isInternational) {
    // Total digits for international format must be at least 8 (1-3 digit CC + min 4 digit subscriber)
    if (digits.length < 8) return false;

    // Country calling code cannot start with 0
    if (digits.startsWith('0')) return false;

    // Specific validation for India (+91)
    if (digits.startsWith('91')) {
      // 91 + 10-digit subscriber number = 12 digits total
      if (digits.length !== 12) return false;
      // Indian 10-digit numbers cannot start with 0 in international format
      if (digits[2] === '0') return false;
      return true;
    }

    // General international numbers (E.164):
    // CC is 1 to 3 digits (1..999). Subscriber must be at least 4 digits.
    const subscriber = digits.slice(1);
    if (subscriber.length >= 4 && !/^0+$/.test(subscriber)) {
      return true;
    }

    return false;
  }

  // National / regional format (without '+')
  if (digits.startsWith('0')) {
    // Cannot start with '00' (international exit code prefix without '+')
    if (digits.startsWith('00')) return false;
    // With trunk prefix '0': 8 to 14 digits
    if (digits.length < 8 || digits.length > 14) return false;
    const nationalNumber = digits.slice(1);
    if (/^0+$/.test(nationalNumber)) return false;
    return true;
  }

  // Bare national number (7 to 14 digits)
  return digits.length >= 7 && digits.length <= 14;
}

export const isValidPhone = isValidPhoneNumber;
