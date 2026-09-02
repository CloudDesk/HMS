import { describe, it, expect } from 'vitest';
import {
  date,
  money,
  label,
  fullName,
  relationshipTag,
  ageOnDate,
  serviceIcon,
} from './formatters';

describe('Portal Formatters & Utilities', () => {
  it('formats dates consistently in Indian English locale', () => {
    const formatted = date('2026-08-25T10:30:00.000Z');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('Aug');
  });

  it('formats currency in Kenyan Shillings (KES)', () => {
    const formatted = money(1500);
    expect(formatted).toContain('1,500');
  });

  it('formats human readable labels from enum keys', () => {
    expect(label('NEW_CONSULTATION')).toBe('New Consultation');
    expect(label('FOLLOW_UP')).toBe('Follow Up');
    expect(label('PARTIALLY_PAID')).toBe('Partially Paid');
  });

  it('formats patient full names and filters empty parts', () => {
    expect(
      fullName({ first_name: 'John', last_name: 'Doe' })
    ).toBe('John Doe');

    expect(
      fullName({
        first_name: 'Jane',
        middle_name: 'Marie',
        last_name: 'Smith',
      })
    ).toBe('Jane Marie Smith');
  });

  it('formats relationship tags', () => {
    expect(relationshipTag('SELF')).toBe('Self');
    expect(relationshipTag('PARENT')).toBe('My child');
    expect(relationshipTag('LEGAL_GUARDIAN')).toBe('Under my care');
    expect(relationshipTag('SPOUSE')).toBe('Spouse');
  });

  it('calculates age from date of birth string', () => {
    const now = new Date();
    const twentyYearsAgo = new Date(
      now.getFullYear() - 20,
      now.getMonth(),
      now.getDate()
    );
    const dobString = twentyYearsAgo.toISOString().slice(0, 10);
    expect(ageOnDate(dobString)).toBe(20);
  });

  it('resolves service icon classes', () => {
    expect(serviceIcon('LAB_TEST')).toBe('ph-flask');
    expect(serviceIcon('IMAGING_SERVICE')).toBe('ph-scan');
    expect(serviceIcon('CONSULTATION')).toBe('ph-stethoscope');
  });
});
