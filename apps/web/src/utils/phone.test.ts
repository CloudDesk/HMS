import { describe, expect, it } from 'vitest';
import { isValidPhoneNumber } from './phone';

describe('apps/web isValidPhoneNumber utility', () => {
  describe('Valid Indian (+91) numbers', () => {
    it.each([
      ['+919876543210'],
      ['+91 98765 43210'],
      ['+91-98765-43210'],
      ['+91 (98765) 43210'],
      ['+91.98765.43210'],
      ['+916234567890'],
      ['+917234567890'],
      ['+918234567890'],
    ])('accepts valid Indian phone: %s', (phone) => {
      expect(isValidPhoneNumber(phone)).toBe(true);
    });
  });

  describe('Valid numbers from other supported international regions', () => {
    it.each([
      ['+14155552671'], // US
      ['+1 (415) 555-2671'], // US formatted
      ['+447911123456'], // UK
      ['+44 7911 123456'], // UK formatted
      ['+254700100200'], // Kenya
      ['+254 700 100 200'], // Kenya formatted
      ['+27821234567'], // South Africa
      ['+971501234567'], // UAE
      ['+6591234567'], // Singapore
      ['+61412345678'], // Australia
    ])('accepts valid international phone: %s', (phone) => {
      expect(isValidPhoneNumber(phone)).toBe(true);
    });
  });

  describe('Valid numbers in accepted national/domestic formats', () => {
    it.each([
      ['9876543210'], // Standard 10-digit national number
      ['09876543210'], // 11-digit with trunk prefix 0
      ['0712345678'], // 10-digit Kenya national with trunk prefix 0
      ['27821234567'], // Unprefixed South Africa number (11 digits)
      ['9999988888'], // 10-digit domestic
    ])('accepts accepted national/domestic format: %s', (phone) => {
      expect(isValidPhoneNumber(phone)).toBe(true);
    });
  });

  describe('Invalid or incomplete country calling codes', () => {
    it.each([
      ['+'],
      ['+0'],
      ['+0123456789'],
      ['+91'], // only country code
      ['+91 123'], // incomplete subscriber number
      ['++919876543210'], // double plus prefix
      ['+910987654321'], // Indian subscriber starting with 0 in international format
    ])('rejects invalid or incomplete country code: %s', (phone) => {
      expect(isValidPhoneNumber(phone)).toBe(false);
    });
  });

  describe('Numbers that are too short or too long', () => {
    it.each([
      ['12345'], // 5 digits (too short)
      ['123456'], // 6 digits (too short)
      ['+91 12345'], // too short for India (5 digits)
      ['1234567890123456'], // 16 digits (too long)
      ['+91123456789012345'], // 17 digits (too long)
    ])('rejects invalid length: %s', (phone) => {
      expect(isValidPhoneNumber(phone)).toBe(false);
    });
  });

  describe('Alphabetic and malformed input', () => {
    it.each([
      ['+9198765abcde'],
      ['phone1234567890'],
      ['invalid-phone'],
      ['+91 (98765'], // unmatched open paren
      ['+91 98765) 43210'], // unmatched close paren
      ['0000000000'], // all zeroes
      ['009876543210'], // international exit prefix '00' without '+'
      [''],
      ['   '],
      [null as unknown as string],
      [undefined as unknown as string],
    ])('rejects malformed or non-phone input: %s', (phone) => {
      expect(isValidPhoneNumber(phone)).toBe(false);
    });
  });
});
