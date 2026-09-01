import { describe, expect, it } from 'vitest';
import {
  calculateDispensingLineTotal,
  calculateDispensingTotal,
  dispensingSourceLabel,
} from './pharmacy-dispensing';

describe('pharmacy dispensing display helpers', () => {
  it('maps every persisted clinical source enum to a user-facing label', () => {
    expect(dispensingSourceLabel('OPD_VISIT')).toBe('OPD Consultation');
    expect(dispensingSourceLabel('EMERGENCY_ENCOUNTER')).toBe('Emergency');
    expect(dispensingSourceLabel('INPATIENT_ADMISSION')).toBe('Inpatient');
    expect(dispensingSourceLabel('PROCEDURE_BOOKING')).toBe('Procedure');
  });

  it('calculates changing line quantities and the multi-medicine total numerically', () => {
    expect(calculateDispensingLineTotal(250, 3)).toBe(750);
    expect(calculateDispensingLineTotal(250, 2)).toBe(500);
    expect(calculateDispensingTotal([{ lineTotal: 200 }, { lineTotal: 350 }, { lineTotal: 450 }])).toBe(1000);
  });

  it('rounds monetary calculations to the same two-decimal precision as billing', () => {
    expect(calculateDispensingLineTotal(10.005, 2)).toBe(20.01);
    expect(calculateDispensingTotal([{ lineTotal: 10.005 }, { lineTotal: 20.005 }])).toBe(30.01);
  });
});
