import { describe, expect, it } from 'vitest';
import { appointmentOphthalmologySchema, appointmentSpecialtyVisitType } from './appointments-ophthalmology';
import { appointmentSpecialtyValue, emptyAppointmentSpecialtyForm } from '../hooks/appointments/appointment-specialty-form';
describe('structured appointment intent transport', () => {
  it('does not manufacture clinical values when specialty details are disabled', () => { expect(appointmentSpecialtyValue(emptyAppointmentSpecialtyForm)).toBeNull(); });
  it('requires explicit valid subtype/eye and a paired catalogue code/version', () => {
    expect(appointmentOphthalmologySchema.safeParse({ visit_subtype: 'SCREENING', affected_eye: '' }).success).toBe(false);
    expect(appointmentOphthalmologySchema.safeParse({ visit_subtype: 'SCREENING', affected_eye: 'NOT_SPECIFIED', sub_speciality_code: 'QA' }).success).toBe(false);
    expect(appointmentOphthalmologySchema.safeParse({ visit_subtype: 'SCREENING', affected_eye: 'NOT_SPECIFIED', referred_by: 'QA' }).success).toBe(false);
  });
  it('maps approved review subtypes without converting them into walk-ins or procedures', () => { expect(appointmentSpecialtyVisitType.POST_OPERATIVE).toBe('REVIEW'); expect(appointmentSpecialtyVisitType.SCREENING).toBe('REVIEW'); expect(appointmentSpecialtyVisitType.PROCEDURE_REVIEW).toBe('REVIEW'); });
  it('serializes clinical scheduling fields without view-only form flags', () => {
    const value = appointmentSpecialtyValue({ ...emptyAppointmentSpecialtyForm, specialty_enabled: true, specialty_subtype: 'POST_OPERATIVE', specialty_eye: 'OS', specialty_referral_source: 'EXTERNAL', specialty_referred_by: ' QA doctor ' });
    expect(value).toMatchObject({ visit_subtype: 'POST_OPERATIVE', affected_eye: 'OS', referral_source: 'EXTERNAL', referred_by: 'QA doctor' }); expect(value).not.toHaveProperty('specialty_enabled');
  });
});
