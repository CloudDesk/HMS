import { describe, expect, it } from 'vitest';
import { calculateAge, formatDateOfBirth, relationshipLabel } from './formatters';

describe('Formatters & Business Logic Helpers', () => {
  describe('calculateAge', () => {
    it('calculates correct age from ISO date of birth', () => {
      const today = new Date();
      const birthYear = today.getFullYear() - 25;
      const dob = `${birthYear}-01-01`;
      const age = calculateAge(dob);
      expect(age).toBeGreaterThanOrEqual(24);
      expect(age).toBeLessThanOrEqual(26);
    });

    it('returns 0 for newborn or invalid date', () => {
      expect(calculateAge('invalid-date')).toBe(0);
      const today = new Date().toISOString().split('T')[0]!;
      expect(calculateAge(today)).toBe(0);
    });

    it('identifies minor vs adult correctly', () => {
      const today = new Date();
      const childBirthYear = today.getFullYear() - 8;
      const childAge = calculateAge(`${childBirthYear}-01-01`);
      expect(childAge < 15).toBe(true);

      const adultBirthYear = today.getFullYear() - 30;
      const adultAge = calculateAge(`${adultBirthYear}-01-01`);
      expect(adultAge >= 15).toBe(true);
    });
  });

  describe('relationshipLabel', () => {
    it('maps backend relationship enums to human readable labels', () => {
      expect(relationshipLabel('SELF')).toBe('Self');
      expect(relationshipLabel('PARENT')).toBe('Parent');
      expect(relationshipLabel('LEGAL_GUARDIAN')).toBe('Legal Guardian');
    });

    it('returns original string if unrecognized', () => {
      expect(relationshipLabel('OTHER_RELATION')).toBe('OTHER_RELATION');
    });
  });

  describe('formatDateOfBirth', () => {
    it('formats ISO timestamp to DD-MM-YYYY', () => {
      expect(formatDateOfBirth('1990-01-01T00:00:00.000Z')).toBe('01-01-1990');
      expect(formatDateOfBirth('1985-12-25T14:30:00.000Z')).toBe('25-12-1985');
    });

    it('formats short YYYY-MM-DD date to DD-MM-YYYY', () => {
      expect(formatDateOfBirth('1990-05-15')).toBe('15-05-1990');
    });

    it('handles null, undefined, or empty values gracefully', () => {
      expect(formatDateOfBirth(null)).toBe('Not recorded');
      expect(formatDateOfBirth(undefined)).toBe('Not recorded');
      expect(formatDateOfBirth('')).toBe('Not recorded');
    });
  });
});
