import { describe, expect, it } from 'vitest';
import { maskMpesaPhone, normalizeMpesaPhone } from './mpesa-phone';

describe('normalizeMpesaPhone', () => {
  it('normalizes 10-digit 07... numbers', () => {
    const result = normalizeMpesaPhone('0712345678');
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe('254712345678');
  });

  it('normalizes 10-digit 01... numbers', () => {
    const result = normalizeMpesaPhone('0112345678');
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe('254112345678');
  });

  it('normalizes international numbers with leading +', () => {
    const result = normalizeMpesaPhone('+254712345678');
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe('254712345678');

    const result2 = normalizeMpesaPhone('+254112345678');
    expect(result2.valid).toBe(true);
    expect(result2.normalized).toBe('254112345678');
  });

  it('normalizes international numbers without leading +', () => {
    const result = normalizeMpesaPhone('254712345678');
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe('254712345678');
  });

  it('handles spaces and hyphens gracefully', () => {
    const result = normalizeMpesaPhone('0712-345 678');
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe('254712345678');

    const result2 = normalizeMpesaPhone('+254 712 345 678');
    expect(result2.valid).toBe(true);
    expect(result2.normalized).toBe('254712345678');
  });

  it('handles 9-digit format missing leading 0', () => {
    const result = normalizeMpesaPhone('712345678');
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe('254712345678');
  });

  it('rejects invalid prefixes', () => {
    expect(normalizeMpesaPhone('0201234567').valid).toBe(false);
    expect(normalizeMpesaPhone('0812345678').valid).toBe(false);
    expect(normalizeMpesaPhone('+255712345678').valid).toBe(false); // Tanzania
  });

  it('rejects numbers that are too short or too long', () => {
    expect(normalizeMpesaPhone('0712345').valid).toBe(false);
    expect(normalizeMpesaPhone('07123456789012').valid).toBe(false);
  });

  it('rejects non-numeric characters', () => {
    expect(normalizeMpesaPhone('0712abc678').valid).toBe(false);
    expect(normalizeMpesaPhone('').valid).toBe(false);
  });
});

describe('maskMpesaPhone', () => {
  it('masks phone numbers showing only last 4 digits', () => {
    const masked = maskMpesaPhone('254712345678');
    expect(masked).toContain('5678');
    expect(masked).not.toContain('7123');
  });
});
