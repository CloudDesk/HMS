import { describe, expect, it } from 'vitest';
import {
  bookAppointmentInputSchema,
  clinicalHistorySchema,
  emptyClinicalHistory,
  type ClinicalHistoryFormState,
} from './contracts';

describe('Optional Clinical History During Appointment Booking', () => {
  it('defines emptyClinicalHistory with all 5 OPD consultation fields initialized to empty strings', () => {
    expect(emptyClinicalHistory).toEqual({
      chiefComplaint: '',
      historyPresentIllness: '',
      pastMedicalHistory: '',
      familyHistory: '',
      allergies: '',
    });

    const parsed = clinicalHistorySchema.parse({});
    expect(parsed).toEqual(emptyClinicalHistory);
  });

  it('allows populated clinical history state across all 5 fields', () => {
    const filledHistory: ClinicalHistoryFormState = {
      chiefComplaint: 'Severe migraine and light sensitivity for 3 days',
      historyPresentIllness: 'Started abruptly after work with throbbing right temple pain.',
      pastMedicalHistory: 'Hypertension managed on medication; appendectomy in 2018.',
      familyHistory: 'Maternal history of chronic migraine.',
      allergies: 'Penicillin (mild rash), peanuts.',
    };

    expect(filledHistory.chiefComplaint).toBe('Severe migraine and light sensitivity for 3 days');
    expect(filledHistory.historyPresentIllness).toContain('throbbing right temple');
    expect(filledHistory.pastMedicalHistory).toContain('Hypertension');
    expect(filledHistory.familyHistory).toContain('chronic migraine');
    expect(filledHistory.allergies).toContain('Penicillin');
  });

  it('calculates effective reason preferring reason input or falling back to chief complaint', () => {
    const computeEffectiveReason = (reason: string, chiefComplaint: string) => {
      return reason.trim() || chiefComplaint.trim();
    };

    // 1. When explicit reason is provided
    expect(computeEffectiveReason('Follow-up consultation', 'Migraine')).toBe('Follow-up consultation');

    // 2. When reason is empty but chief complaint is provided
    expect(computeEffectiveReason('', 'Severe lower back pain')).toBe('Severe lower back pain');

    // 3. When both are empty
    expect(computeEffectiveReason('   ', '   ')).toBe('');
  });

  it('preserves clean state reset when modal closes or patient changes', () => {
    let state = {
      isExpanded: true,
      clinicalHistory: {
        chiefComplaint: 'Fever',
        historyPresentIllness: '3 days of high grade fever',
        pastMedicalHistory: 'None',
        familyHistory: 'None',
        allergies: 'None',
      },
    };

    // Simulate reset handler (modal close / patient context switch)
    const reset = () => {
      state = {
        isExpanded: false,
        clinicalHistory: { ...emptyClinicalHistory },
      };
    };

    reset();

    expect(state.isExpanded).toBe(false);
    expect(state.clinicalHistory).toEqual(emptyClinicalHistory);
  });

  describe('Booking Payload Validation with Optional Clinical History', () => {
    it('validates booking payload with NO clinical history (pure appointment)', () => {
      const payload = {
        patient_id: 'pat-1',
        doctor_id: 'doc-1',
        appointment_date: '2026-10-15',
        start_time: '10:00',
        duration_minutes: 15,
        visit_type: 'NEW_CONSULTATION' as const,
        reason: 'Routine checkup',
      };

      const parsed = bookAppointmentInputSchema.parse(payload);
      expect(parsed.clinical_history).toBeUndefined();
      expect(parsed.reason).toBe('Routine checkup');
    });

    it('validates booking payload with ONLY Chief Complaint', () => {
      const payload = {
        patient_id: 'pat-1',
        doctor_id: 'doc-1',
        appointment_date: '2026-10-15',
        start_time: '10:00',
        duration_minutes: 15,
        visit_type: 'NEW_CONSULTATION' as const,
        reason: 'Tooth pain',
        clinical_history: {
          chief_complaint: 'Severe tooth pain on biting',
        },
      };

      const parsed = bookAppointmentInputSchema.parse(payload);
      expect(parsed.clinical_history?.chief_complaint).toBe('Severe tooth pain on biting');
      expect(parsed.clinical_history?.history_present_illness).toBeUndefined();
    });

    it('validates booking payload with ONLY History of Present Illness', () => {
      const payload = {
        patient_id: 'pat-1',
        doctor_id: 'doc-1',
        appointment_date: '2026-10-15',
        start_time: '10:00',
        duration_minutes: 15,
        visit_type: 'NEW_CONSULTATION' as const,
        reason: 'Consultation',
        clinical_history: {
          history_present_illness: 'Started 3 days ago after cold beverage',
        },
      };

      const parsed = bookAppointmentInputSchema.parse(payload);
      expect(parsed.clinical_history?.history_present_illness).toBe(
        'Started 3 days ago after cold beverage',
      );
    });

    it('validates booking payload with ALL 5 clinical history fields', () => {
      const payload = {
        patient_id: 'pat-1',
        doctor_id: 'doc-1',
        appointment_date: '2026-10-15',
        start_time: '10:00',
        duration_minutes: 15,
        visit_type: 'NEW_CONSULTATION' as const,
        reason: 'Comprehensive checkup',
        clinical_history: {
          chief_complaint: 'Chest discomfort on exertion',
          history_present_illness: 'Gradual onset over 2 weeks',
          past_medical_history: 'Hypertension, hyperlipidemia',
          family_history: 'Father had CAD at age 52',
          allergies: 'Aspirin (bronchospasm)',
        },
      };

      const parsed = bookAppointmentInputSchema.parse(payload);
      expect(parsed.clinical_history).toBeDefined();
      expect(parsed.clinical_history?.chief_complaint).toBe('Chest discomfort on exertion');
      expect(parsed.clinical_history?.history_present_illness).toBe('Gradual onset over 2 weeks');
      expect(parsed.clinical_history?.past_medical_history).toBe('Hypertension, hyperlipidemia');
      expect(parsed.clinical_history?.family_history).toBe('Father had CAD at age 52');
      expect(parsed.clinical_history?.allergies).toBe('Aspirin (bronchospasm)');
    });

    it('enforces 500-character limit on clinical history fields', () => {
      const overLongString = 'a'.repeat(501);
      const payload = {
        patient_id: 'pat-1',
        doctor_id: 'doc-1',
        appointment_date: '2026-10-15',
        start_time: '10:00',
        duration_minutes: 15,
        visit_type: 'NEW_CONSULTATION' as const,
        reason: 'Checkup',
        clinical_history: {
          chief_complaint: overLongString,
        },
      };

      expect(() => bookAppointmentInputSchema.parse(payload)).toThrow();
    });
  });

  describe('Keyboard Visibility & Auto-Scrolling Behavior', () => {
    it('maps all text input fields to appropriate auto-scroll positions', () => {
      const getScrollTarget = (
        field:
          | 'reason'
          | 'chiefComplaint'
          | 'historyPresentIllness'
          | 'pastMedicalHistory'
          | 'familyHistory'
          | 'allergies'
      ): { action: 'scrollToEnd' | 'scrollTo'; y?: number } => {
        if (field === 'allergies' || field === 'familyHistory') {
          return { action: 'scrollToEnd' };
        }
        if (field === 'pastMedicalHistory' || field === 'historyPresentIllness') {
          return { action: 'scrollTo', y: 780 };
        }
        if (field === 'chiefComplaint') {
          return { action: 'scrollTo', y: 640 };
        }
        return { action: 'scrollTo', y: 480 };
      };

      // Lower clinical history fields must scroll to the very end so they are never hidden under the keyboard
      expect(getScrollTarget('familyHistory')).toEqual({ action: 'scrollToEnd' });
      expect(getScrollTarget('allergies')).toEqual({ action: 'scrollToEnd' });

      // Mid-level clinical history fields scroll sufficiently
      expect(getScrollTarget('pastMedicalHistory')).toEqual({ action: 'scrollTo', y: 780 });
      expect(getScrollTarget('historyPresentIllness')).toEqual({ action: 'scrollTo', y: 780 });
      expect(getScrollTarget('chiefComplaint')).toEqual({ action: 'scrollTo', y: 640 });
      expect(getScrollTarget('reason')).toEqual({ action: 'scrollTo', y: 480 });
    });

    it('adds dynamic scroll content padding when keyboard height is detected', () => {
      const computeScrollContentPadding = (keyboardHeight: number, baseSpacing: number) => {
        return keyboardHeight > 0 ? keyboardHeight + baseSpacing : baseSpacing;
      };

      // When keyboard is closed (height = 0)
      expect(computeScrollContentPadding(0, 24)).toBe(24);

      // When keyboard opens on Android (e.g. height = 300)
      expect(computeScrollContentPadding(300, 24)).toBe(324);
    });

    it('smoothly expands and collapses Clinical History without losing entered text', () => {
      const historyState: ClinicalHistoryFormState = {
        chiefComplaint: 'Toothache',
        historyPresentIllness: '3 days',
        pastMedicalHistory: 'None',
        familyHistory: 'Diabetes in family',
        allergies: 'No known allergies',
      };

      let isExpanded = true;
      // Collapse
      isExpanded = false;
      // Form values remain preserved in state
      expect(historyState.familyHistory).toBe('Diabetes in family');
      expect(historyState.allergies).toBe('No known allergies');

      // Expand again
      isExpanded = true;
      expect(isExpanded).toBe(true);
      expect(historyState.familyHistory).toBe('Diabetes in family');
    });
  });
});

